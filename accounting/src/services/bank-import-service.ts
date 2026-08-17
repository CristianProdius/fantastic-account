import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { and, eq, isNull } from 'drizzle-orm';
import type { AppDb } from '../db/client.js';
import { bankAccounts, bankStatementImports, bankTransactions } from '../db/schema.js';
import { bankDropDir } from '../paths.js';
import { getCompany } from './company-service.js';

export type ParsedBankRow = {
  bookingDate: string;
  direction: 'debit' | 'credit';
  amount: string;
  currency: string;
  counterpartyName: string | null;
  description: string | null;
  fingerprint: string;
};

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export const parseBankCsv = (text: string): ParsedBankRow[] => {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const header = (lines[0] ?? '').toLowerCase();
  const rows: ParsedBankRow[] = [];
  for (const line of lines.slice(1)) {
    const parts = line.split(/[;,]/).map((part) => part.trim().replace(/^"|"$/g, ''));
    const date =
      parts.find((part) => /^\d{4}-\d{2}-\d{2}$/.test(part) || /^\d{2}\.\d{2}\.\d{4}$/.test(part)) ??
      null;
    if (!date) continue;
    const bookingDate = date.includes('.')
      ? `${date.slice(6, 10)}-${date.slice(3, 5)}-${date.slice(0, 2)}`
      : date;
    const amounts = parts
      .map((part) => Number(part.replace(/\s/g, '').replace(',', '.')))
      .filter((value) => Number.isFinite(value) && value !== 0);
    const amount = amounts[0];
    if (!amount) continue;
    const direction: 'debit' | 'credit' =
      header.includes('debit') && parts[2] && Number(parts[2].replace(',', '.')) > 0
        ? 'debit'
        : amount < 0
          ? 'debit'
          : 'credit';
    const abs = Math.abs(amount).toFixed(2);
    const description = parts.slice(1).join(' ').slice(0, 500);
    rows.push({
      bookingDate,
      direction,
      amount: abs,
      currency: 'MDL',
      counterpartyName: parts[3] ?? null,
      description,
      fingerprint: sha256(`${bookingDate}|${direction}|${abs}|${description}`),
    });
  }

  return rows;
};

export const importBankFolder = async (
  db: AppDb,
  input: { companyId: string; iban?: string },
) => {
  const { company } = await getCompany(db, input.companyId);
  const directory = bankDropDir(company.slug);
  let names: string[] = [];
  try {
    names = (await readdir(directory)).filter((name) => extname(name).toLowerCase() === '.csv');
  } catch {
    names = [];
  }

  if (names.length === 0) {
    return {
      companyId: company.slug,
      imported: 0,
      transactions: 0,
      nextStep:
        'Nu am găsit CSV în 02_Extrase_Bancare. Descarcă extrasul din internet banking și pune-l acolo.',
    };
  }

  const [account] = input.iban
    ? await db.select().from(bankAccounts).where(eq(bankAccounts.iban, input.iban))
    : await db.select().from(bankAccounts).where(eq(bankAccounts.companyId, company.slug));

  if (!account) {
    return {
      companyId: company.slug,
      imported: 0,
      transactions: 0,
      nextStep:
        'Încă nu avem IBAN-ul firmei. Răspunde la întrebarea de onboarding despre bancă, apoi reîncercăm.',
    };
  }

  let imported = 0;
  let transactions = 0;

  for (const fileName of names) {
    const text = await readFile(join(directory, fileName), 'utf8');
    const digest = sha256(text);
    const rows = parseBankCsv(text);
    const [existing] = await db
      .insert(bankStatementImports)
      .values({
        companyId: company.slug,
        bankAccountIban: account.iban,
        fileName,
        fileSha256: digest,
      })
      .onConflictDoNothing()
      .returning();

    if (!existing) continue;
    imported += 1;

    for (const [index, row] of rows.entries()) {
      const inserted = await db
        .insert(bankTransactions)
        .values({
          companyId: company.slug,
          importId: existing.id,
          bookingDate: row.bookingDate,
          direction: row.direction,
          amount: row.amount,
          currency: row.currency,
          counterpartyName: row.counterpartyName,
          description: row.description,
          fingerprint: row.fingerprint,
          importRowNumber: index + 1,
        })
        .onConflictDoNothing()
        .returning();
      transactions += inserted.length;
    }
  }

  return { companyId: company.slug, imported, transactions, nextStep: null };
};

export const listUnclassifiedBank = async (db: AppDb, companyId: string) =>
  db
    .select()
    .from(bankTransactions)
    .where(and(eq(bankTransactions.companyId, companyId), isNull(bankTransactions.journalEntryId)));
