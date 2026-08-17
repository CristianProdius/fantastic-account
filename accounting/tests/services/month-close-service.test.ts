import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  accounts,
  bankAccounts,
  bankStatementImports,
  bankTransactions,
  companies,
  monthlyObligationInstances,
  monthlyObligationTemplates,
  taxProfiles,
} from '../../src/db/schema.js';
import {
  seedAccounts,
  seedCompanies,
  seedObligationTemplates,
  seedTaxProfiles,
} from '../../src/db/seed.js';
import { importDeclarations } from '../../src/services/declaration-import-service.js';
import {
  checkCloseReadiness,
  ensureObligationInstances,
} from '../../src/services/month-close-service.js';
import { companyRoot } from '../../src/paths.js';
import { createTestDb, resetTestDb } from '../db/helpers.js';

const db = createTestDb();

const seedMinimum = async () => {
  await db.insert(accounts).values(seedAccounts.map((row) => ({ ...row, isPostable: true, isActive: true })));
  await db.insert(companies).values(
    seedCompanies.map((row) => ({
      ...row,
      documentsRoot: companyRoot(row.slug),
    })),
  );
  await db.insert(taxProfiles).values(
    seedTaxProfiles.map((row) => ({
      ...row,
      itPark: false,
      source: 'declaration',
    })),
  );
  await db.insert(monthlyObligationTemplates).values(
    seedObligationTemplates.map((row) => ({
      ...row,
      active: true,
    })),
  );
};

describe('month close', () => {
  beforeEach(async () => {
    await resetTestDb(db);
    await seedMinimum();
  });

  afterAll(async () => {
    await db.$client.end();
  });

  it('opens TVA12 + IPC21 for Fantastic June 2026 and blocks close while they are pending', async () => {
    await importDeclarations(db, 'global-fantastic');

    const june = await ensureObligationInstances(db, {
      companyId: 'global-fantastic',
      year: 2026,
      month: 6,
    });
    expect(june.applicable).toBe(2);
    expect(june.created).toBe(2);

    const again = await ensureObligationInstances(db, {
      companyId: 'global-fantastic',
      year: 2026,
      month: 6,
    });
    expect(again.created).toBe(0);

    const march = await ensureObligationInstances(db, {
      companyId: 'global-fantastic',
      year: 2026,
      month: 3,
    });
    expect(march.applicable).toBe(4);

    const readiness = await checkCloseReadiness(db, {
      companyId: 'global-fantastic',
      year: 2026,
      month: 6,
    });
    expect(readiness.ready).toBe(false);
    expect(readiness.unclassifiedBank).toBe(0);
    expect(readiness.pendingObligations.map((row) => row.templateId)).toHaveLength(2);

    const pendingNames = (
      await db
        .select({
          name: monthlyObligationTemplates.name,
          status: monthlyObligationInstances.status,
        })
        .from(monthlyObligationInstances)
        .innerJoin(
          monthlyObligationTemplates,
          eq(monthlyObligationInstances.templateId, monthlyObligationTemplates.id),
        )
        .where(eq(monthlyObligationInstances.month, 6))
    ).map((row) => row.name);
    expect(pendingNames.sort()).toEqual(['IPC21', 'TVA12']);

    await db
      .update(monthlyObligationInstances)
      .set({ status: 'completed', completedBy: 'test', completedAt: new Date() })
      .where(eq(monthlyObligationInstances.month, 6));

    const closed = await checkCloseReadiness(db, {
      companyId: 'global-fantastic',
      year: 2026,
      month: 6,
    });
    expect(closed.ready).toBe(true);
    expect(closed.pendingObligations).toHaveLength(0);
  });

  it('fails June close when an unclassified bank line exists', async () => {
    await db.insert(bankAccounts).values({
      iban: 'MD24AG000000022511054710',
      companyId: 'global-fantastic',
      currency: 'MDL',
      name: 'Current MDL',
      bankName: 'MAIB',
      accountCode: '2421',
    });
    const [imported] = await db
      .insert(bankStatementImports)
      .values({
        companyId: 'global-fantastic',
        bankAccountIban: 'MD24AG000000022511054710',
        fileName: 'june-2026.csv',
        fileSha256: 'test-sha-june-2026',
      })
      .returning();
    await db.insert(bankTransactions).values({
      companyId: 'global-fantastic',
      importId: imported!.id,
      bookingDate: '2026-06-15',
      direction: 'credit',
      amount: '1000.00',
      currency: 'MDL',
      counterpartyName: 'Client',
      description: 'unclassified inflow',
      fingerprint: 'gf-june-2026-unclassified',
      importRowNumber: 1,
    });

    await ensureObligationInstances(db, {
      companyId: 'global-fantastic',
      year: 2026,
      month: 6,
    });
    await db
      .update(monthlyObligationInstances)
      .set({ status: 'completed', completedBy: 'test', completedAt: new Date() })
      .where(eq(monthlyObligationInstances.companyId, 'global-fantastic'));

    const readiness = await checkCloseReadiness(db, {
      companyId: 'global-fantastic',
      year: 2026,
      month: 6,
    });
    expect(readiness.ready).toBe(false);
    expect(readiness.pendingObligations).toHaveLength(0);
    expect(readiness.unclassifiedBank).toBe(1);
  });
});
