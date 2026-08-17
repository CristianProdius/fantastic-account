import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { seedAccounts, seedCompanies, seedTaxProfiles } from '../../src/db/seed.js';
import { accounts, bankAccounts, companies, taxProfiles } from '../../src/db/schema.js';
import { importBankFolder } from '../../src/services/bank-import-service.js';
import {
  completeOnboarding,
  getOnboardingStatus,
  ONBOARDING_QUESTIONS,
  parseMoldovanIbanAnswer,
  saveOnboardingAnswer,
} from '../../src/services/onboarding-service.js';
import { createTestDb, resetTestDb } from '../db/helpers.js';

const db = createTestDb();

const seedMinimum = async () => {
  await db.insert(accounts).values(seedAccounts.map((row) => ({ ...row, isPostable: true, isActive: true })));
  await db.insert(companies).values(
    seedCompanies.map((row) => ({
      ...row,
      documentsRoot: `/tmp/${row.slug}`,
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

describe('onboarding', () => {
  beforeEach(async () => {
    await resetTestDb(db);
    await seedMinimum();
  });

  afterAll(async () => {
    await db.$client.end();
  });

  it('prefills SIMM + VAT from the declaration profile and stays skippable', async () => {
    expect(ONBOARDING_QUESTIONS).toHaveLength(9);
    const status = await getOnboardingStatus(db, 'rare-people');
    expect(status.complete).toBe(false);
    expect(status.questions[0]?.prefill).toContain('SIMM 4%');
    expect(status.questions[0]?.prefill).toContain('TVA');

    const skipped = await saveOnboardingAnswer(db, {
      companyId: 'rare-people',
      questionKey: 'activity',
      skip: true,
    });
    expect(skipped.questions.find((row) => row.key === 'activity')?.skipped).toBe(true);

    const done = await completeOnboarding(db, 'rare-people');
    expect(done.complete).toBe(true);
    expect(done.bankAccounts).toEqual([]);
  });

  it('parses spaced Moldovan IBANs and named banks', () => {
    expect(parseMoldovanIbanAnswer('MD24 AG00 0000 0225 1105 4710 MAIB')).toEqual({
      iban: 'MD24AG000000022511054710',
      bankName: 'MAIB',
    });
    expect(parseMoldovanIbanAnswer('md24vi000000022511054710')).toEqual({
      iban: 'MD24VI000000022511054710',
      bankName: 'Victoriabank',
    });
    expect(parseMoldovanIbanAnswer('nu am IBAN')).toBeNull();
  });

  it('inserts bank_accounts when onboarding saves an IBAN', async () => {
    const status = await saveOnboardingAnswer(db, {
      companyId: 'global-fantastic',
      questionKey: 'bank_iban_mdl',
      value: 'MAIB MD24AG000000022511054710',
    });

    expect(status.bankAccounts).toEqual([
      {
        iban: 'MD24AG000000022511054710',
        bankName: 'MAIB',
        currency: 'MDL',
        accountCode: '2421',
      },
    ]);

    const rows = await db.select().from(bankAccounts);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      iban: 'MD24AG000000022511054710',
      companyId: 'global-fantastic',
      name: 'Cont curent MDL',
    });

    const again = await saveOnboardingAnswer(db, {
      companyId: 'global-fantastic',
      questionKey: 'bank_iban_mdl',
      value: 'MD24AG000000022511054710 Moldova Agroindbank',
    });
    expect(again.bankAccounts).toHaveLength(1);

    await saveOnboardingAnswer(db, {
      companyId: 'rare-people',
      questionKey: 'bank_iban_mdl',
      skip: true,
    });
    expect(await db.select().from(bankAccounts)).toHaveLength(1);

    await expect(
      saveOnboardingAnswer(db, {
        companyId: 'rare-people',
        questionKey: 'bank_iban_mdl',
        value: 'contul de la MAIB, ți-l trimit mâine',
      }),
    ).rejects.toThrow(/IBAN moldovenesc/);

    const imported = await importBankFolder(db, { companyId: 'global-fantastic' });
    expect(imported.nextStep).toMatch(/Nu am găsit CSV/);
    expect(imported.nextStep).not.toMatch(/IBAN/);
  });
});
