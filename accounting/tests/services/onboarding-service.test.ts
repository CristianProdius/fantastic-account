import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { seedAccounts, seedCompanies, seedTaxProfiles } from '../../src/db/seed.js';
import { accounts, companies, taxProfiles } from '../../src/db/schema.js';
import {
  completeOnboarding,
  getOnboardingStatus,
  ONBOARDING_QUESTIONS,
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
  });
});
