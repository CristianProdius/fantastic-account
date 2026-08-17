import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { accounts, companies, taxProfiles } from '../../src/db/schema.js';
import { seedAccounts, seedCompanies, seedTaxProfiles } from '../../src/db/seed.js';
import { importDeclarations } from '../../src/services/declaration-import-service.js';
import { whatDoIOwe } from '../../src/services/tax-due-service.js';
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
};

describe('whatDoIOwe', () => {
  beforeEach(async () => {
    await resetTestDb(db);
    await seedMinimum();
  });

  afterAll(async () => {
    await db.$client.end();
  });

  it('returns Fantastic June 2026 VAT, SIMM carry-forward and IPC21 payroll', async () => {
    const imported = await importDeclarations(db, 'global-fantastic');
    expect(imported.upserted).toBeGreaterThan(70);
    expect(imported.employees).toBeGreaterThan(0);

    const dues = await whatDoIOwe(db, {
      companyId: 'global-fantastic',
      year: 2026,
      month: 6,
    });

    expect(dues.regime).toBe('simm24');
    expect(dues.vatPayer).toBe(true);
    expect(dues.itPark).toBe(false);

    const vat = dues.items.find((item) => item.kind === 'vat');
    expect(vat?.amount).toBe(-155.57);
    expect(vat?.sourcePeriod).toBe('L/06/2026');
    expect(vat?.note).toMatch(/TVA de recuperat 155\.57/);

    const simm = dues.items.find((item) => item.kind === 'simm');
    expect(simm?.amount).toBe(32355.52);
    expect(simm?.sourcePeriod).toBe('A/2025');
    expect(simm?.note).toMatch(/2026 nu e închis/);

    const payroll = dues.items.find((item) => item.kind === 'payroll');
    expect(payroll?.name).toBe('IPC21 / salarii');
    expect(payroll?.amount).toBe(1200);
    expect(payroll?.sourcePeriod).toBe('L/06/2026');
    expect(payroll?.note).toBe('Bază 5000 MDL, impozit 1200 MDL, contribuții 0 MDL');
  });
});
