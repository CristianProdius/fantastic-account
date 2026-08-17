import { and, eq } from 'drizzle-orm';
import type { AppDb } from '../db/client.js';
import { bankAccounts, onboardingAnswers, taxProfiles } from '../db/schema.js';
import { getCompany } from './company-service.js';

const MD_IBAN_RE = /MD[0-9]{2}[A-Z0-9]{20}/i;

const BANK_CODE_NAMES: Record<string, string> = {
  AG: 'MAIB',
  VI: 'Victoriabank',
  ML: 'MICB',
  EX: 'Eximbank',
  MO: 'OTP / Mobiasbanca',
};

const NAMED_BANKS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /\bmaib\b|agroind/i, name: 'MAIB' },
  { pattern: /\bvictoriabank\b|\bvb\b/i, name: 'Victoriabank' },
  { pattern: /\bmicb\b|moldindcon/i, name: 'MICB' },
  { pattern: /\beximbank\b/i, name: 'Eximbank' },
  { pattern: /\botp\b|mobias/i, name: 'OTP / Mobiasbanca' },
];

export const parseMoldovanIbanAnswer = (
  value: string,
): { iban: string; bankName: string } | null => {
  const compact = value.replace(/[\s-]/g, '').toUpperCase();
  const match = compact.match(MD_IBAN_RE);
  if (!match) return null;
  const iban = match[0];
  const fromText = NAMED_BANKS.find((bank) => bank.pattern.test(value))?.name;
  const fromCode = BANK_CODE_NAMES[iban.slice(4, 6)];
  return { iban, bankName: fromText ?? fromCode ?? 'Bancă necunoscută' };
};

export const ONBOARDING_QUESTIONS = [
  {
    key: 'tax_regime',
    prompt:
      'Confirmi regimul din declarații: SIMM 4% + plătitor de TVA? (da / nu, și ce e în loc)',
    prefillFrom: 'declaration',
  },
  {
    key: 'activity',
    prompt: 'Ce vinde de fapt firma? (o propoziție)',
  },
  {
    key: 'bank_iban_mdl',
    prompt: 'IBAN-ul contului curent în lei și banca.',
  },
  {
    key: 'employees',
    prompt: 'Cine e pe statul de plată luna aceasta și ce salariu are?',
  },
  {
    key: 'efactura',
    prompt: 'Emiteți sau primiți e-Factura? (da / nu)',
  },
  {
    key: 'fx',
    prompt: 'Aveți facturi sau conturi în valută? (da / nu)',
  },
  {
    key: 'related_party',
    prompt: 'Sunt plăți între Global Fantastic și Rare People? (da / nu)',
  },
  {
    key: 'one_c_export',
    prompt:
      'Poți salva din 1C rapoartele Excel în folderul 04_Export_1C. Spune „am pus fișierele din 1C” sau „sar peste”.',
  },
  {
    key: 'signer',
    prompt: 'Cine semnează declarațiile? (implicit Popescu Mihail)',
  },
] as const;

export type OnboardingQuestionKey = (typeof ONBOARDING_QUESTIONS)[number]['key'];

const prefillValue = async (db: AppDb, companyId: string, key: string) => {
  const { company, profile } = await getCompany(db, companyId);
  if (key === 'tax_regime') {
    const regime = profile?.regime === 'simm24' ? 'SIMM 4%' : profile?.regime;
    const vat = profile?.vatPayer ? 'plătitor de TVA' : 'fără TVA';
    return `${regime} + ${vat} (din declarațiile SFS)`;
  }

  if (key === 'signer') {
    return company.administratorName;
  }

  if (key === 'employees' && companyId === 'rare-people') {
    return 'Niciun salariat în declarațiile depuse';
  }

  if (key === 'employees' && companyId === 'global-fantastic') {
    return 'În 2025: doar Popescu Mihail (60 000 MDL/an în IALS). Confirmă salariul curent.';
  }

  return null;
};

export const getOnboardingStatus = async (db: AppDb, companyId: string) => {
  const answers = await db
    .select()
    .from(onboardingAnswers)
    .where(eq(onboardingAnswers.companyId, companyId));
  const byKey = new Map(answers.map((row) => [row.questionKey, row]));

  const questions = await Promise.all(
    ONBOARDING_QUESTIONS.map(async (question) => {
      const existing = byKey.get(question.key);
      const prefill = await prefillValue(db, companyId, question.key);
      return {
        key: question.key,
        prompt: question.prompt,
        prefill,
        answered: Boolean(existing),
        skipped: existing?.skipped ?? false,
        value: existing?.value ?? prefill,
      };
    }),
  );

  const pending = questions.filter((question) => !question.answered);
  const accounts = await db.select().from(bankAccounts).where(eq(bankAccounts.companyId, companyId));
  return {
    companyId,
    complete: pending.length === 0,
    pendingCount: pending.length,
    nextQuestion: pending[0] ?? null,
    questions,
    bankAccounts: accounts.map((row) => ({
      iban: row.iban,
      bankName: row.bankName,
      currency: row.currency,
      accountCode: row.accountCode,
    })),
  };
};

const upsertMdlBankAccount = async (db: AppDb, companyId: string, answer: string) => {
  const parsed = parseMoldovanIbanAnswer(answer);
  if (!parsed) {
    throw new Error(
      'Nu am recunoscut un IBAN moldovenesc (începe cu MD, 24 caractere). Exemplu: MD24AG000000022511054710 MAIB',
    );
  }

  await db
    .insert(bankAccounts)
    .values({
      iban: parsed.iban,
      companyId,
      currency: 'MDL',
      name: 'Cont curent MDL',
      bankName: parsed.bankName,
      accountCode: '2421',
    })
    .onConflictDoUpdate({
      target: bankAccounts.iban,
      set: {
        companyId,
        currency: 'MDL',
        name: 'Cont curent MDL',
        bankName: parsed.bankName,
        accountCode: '2421',
      },
    });

  return parsed;
};

export const saveOnboardingAnswer = async (
  db: AppDb,
  input: { companyId: string; questionKey: string; value?: string; skip?: boolean },
) => {
  const question = ONBOARDING_QUESTIONS.find((item) => item.key === input.questionKey);
  if (!question) {
    throw new Error(`Unknown onboarding question "${input.questionKey}"`);
  }

  const value = input.skip ? 'skipped' : (input.value?.trim() ?? '');
  if (!input.skip && !value) {
    throw new Error('Trimite un răspuns sau spune că sari peste.');
  }

  if (input.questionKey === 'bank_iban_mdl' && !input.skip) {
    await upsertMdlBankAccount(db, input.companyId, value);
  }

  await db
    .insert(onboardingAnswers)
    .values({
      companyId: input.companyId,
      questionKey: input.questionKey,
      value,
      skipped: Boolean(input.skip),
    })
    .onConflictDoUpdate({
      target: [onboardingAnswers.companyId, onboardingAnswers.questionKey],
      set: {
        value,
        skipped: Boolean(input.skip),
        answeredAt: new Date(),
      },
    });

  if (input.questionKey === 'tax_regime' && !input.skip && input.value) {
    const text = input.value.toLowerCase();
    const vatPayer = !text.includes('fără tva') && !text.includes('fara tva');
    const regime = text.includes('ven12') || text.includes('12%') ? 'ven12' : 'simm24';
    await db
      .update(taxProfiles)
      .set({
        regime,
        vatPayer,
        source: 'onboarding',
        updatedAt: new Date(),
      })
      .where(eq(taxProfiles.companyId, input.companyId));
  }

  return getOnboardingStatus(db, input.companyId);
};

export const completeOnboarding = async (db: AppDb, companyId: string) => {
  const status = await getOnboardingStatus(db, companyId);
  for (const question of status.questions) {
    if (!question.answered) {
      await saveOnboardingAnswer(db, {
        companyId,
        questionKey: question.key,
        value: question.prefill ?? 'skipped',
        skip: !question.prefill,
      });
    }
  }

  return getOnboardingStatus(db, companyId);
};

export const findAnswer = async (db: AppDb, companyId: string, questionKey: string) => {
  const [row] = await db
    .select()
    .from(onboardingAnswers)
    .where(
      and(
        eq(onboardingAnswers.companyId, companyId),
        eq(onboardingAnswers.questionKey, questionKey),
      ),
    );

  return row ?? null;
};
