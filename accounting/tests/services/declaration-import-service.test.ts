import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { accounts, companies, taxProfiles } from '../../src/db/schema.js';
import { seedAccounts, seedCompanies, seedTaxProfiles } from '../../src/db/seed.js';
import { importDeclarations, listDeclarations } from '../../src/services/declaration-import-service.js';
import { reconstructFromDeclarations } from '../../src/services/snapshot-journal-service.js';
import { whatDoIOwe } from '../../src/services/tax-due-service.js';
import { getTrialBalance } from '../../src/services/journal-service.js';
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

describe('declaration import and reconstruction', () => {
  beforeEach(async () => {
    await resetTestDb(db);
    await seedMinimum();
  });

  afterAll(async () => {
    await db.$client.end();
  });

  it('imports Rare People declarations and reconstructs SIMM tax', async () => {
    const imported = await importDeclarations(db, 'rare-people');
    expect(imported.upserted).toBeGreaterThan(10);
    const simm = await listDeclarations(db, {
      companyId: 'rare-people',
      formType: 'simm24',
      year: 2025,
    });
    const latest = simm.at(-1);
    expect(Number((latest?.extracted as { taxDue?: number }).taxDue)).toBeGreaterThan(20000);

    const reconstructed = await reconstructFromDeclarations(db, 'rare-people');
    expect(reconstructed.taxes).toBeGreaterThan(0);
    const again = await reconstructFromDeclarations(db, 'rare-people');
    expect(again.taxes).toBe(0);

    const trial = await getTrialBalance(db, 'rare-people');
    const simmLiability = trial.find((row) => row.accountCode === '5342');
    expect(simmLiability?.credit).toBeGreaterThan(0);

    const dues = await whatDoIOwe(db, { companyId: 'rare-people', year: 2025, month: 12 });
    expect(dues.regime).toBe('simm24');
    expect(dues.itPark).toBe(false);
    expect(dues.items.some((item) => item.kind === 'simm')).toBe(true);
  });
});
