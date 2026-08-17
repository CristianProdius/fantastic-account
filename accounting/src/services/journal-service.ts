import { and, eq } from 'drizzle-orm';
import type { AppDb } from '../db/client.js';
import { fiscalPeriods, journalEntries, journalLines } from '../db/schema.js';

export type JournalLineInput = {
  accountCode: string;
  debit: string;
  credit: string;
};

export const findEntryByReference = async (
  db: AppDb,
  companyId: string,
  reference: string,
) => {
  const [row] = await db
    .select()
    .from(journalEntries)
    .where(and(eq(journalEntries.companyId, companyId), eq(journalEntries.reference, reference)));
  return row ?? null;
};

export const postBalancedEntry = async (
  db: AppDb,
  input: {
    companyId: string;
    date: string;
    description: string;
    reference: string;
    source: 'tax' | 'snapshot' | 'payroll' | 'one_c_export' | 'manual';
    lines: JournalLineInput[];
  },
) => {
  const existing = await findEntryByReference(db, input.companyId, input.reference);
  if (existing) {
    return { entry: existing, created: false };
  }

  const debit = input.lines.reduce((sum, line) => sum + Number(line.debit), 0);
  const credit = input.lines.reduce((sum, line) => sum + Number(line.credit), 0);
  if (Math.abs(debit - credit) > 0.009) {
    throw new Error(`Unbalanced journal ${input.reference}: debit ${debit} credit ${credit}`);
  }

  const [entry] = await db
    .insert(journalEntries)
    .values({
      companyId: input.companyId,
      date: input.date,
      description: input.description,
      reference: input.reference,
      source: input.source,
      status: 'posted',
      postedAt: new Date(),
    })
    .returning();

  if (!entry) {
    throw new Error('Failed to insert journal entry');
  }

  await db.insert(journalLines).values(
    input.lines.map((line, index) => ({
      entryId: entry.id,
      lineNo: index + 1,
      accountCode: line.accountCode,
      debit: line.debit,
      credit: line.credit,
    })),
  );

  return { entry, created: true };
};

export const setPeriodStatus = async (
  db: AppDb,
  input: { companyId: string; year: number; month: number; status: 'open' | 'closed' | 'locked' },
) => {
  const [row] = await db
    .update(fiscalPeriods)
    .set({ status: input.status })
    .where(
      and(
        eq(fiscalPeriods.companyId, input.companyId),
        eq(fiscalPeriods.year, input.year),
        eq(fiscalPeriods.month, input.month),
      ),
    )
    .returning();

  if (!row) {
    throw new Error(`No fiscal period ${input.year}-${input.month} for ${input.companyId}`);
  }

  return row;
};

export const getTrialBalance = async (db: AppDb, companyId: string) => {
  const rows = await db
    .select({
      entryId: journalLines.entryId,
      accountCode: journalLines.accountCode,
      debit: journalLines.debit,
      credit: journalLines.credit,
      companyId: journalEntries.companyId,
      status: journalEntries.status,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .where(and(eq(journalEntries.companyId, companyId), eq(journalEntries.status, 'posted')));

  const totals = new Map<string, { debit: number; credit: number }>();
  for (const row of rows) {
    const current = totals.get(row.accountCode) ?? { debit: 0, credit: 0 };
    current.debit += Number(row.debit);
    current.credit += Number(row.credit);
    totals.set(row.accountCode, current);
  }

  return [...totals.entries()]
    .map(([accountCode, amount]) => ({
      accountCode,
      debit: Number(amount.debit.toFixed(2)),
      credit: Number(amount.credit.toFixed(2)),
      net: Number((amount.debit - amount.credit).toFixed(2)),
    }))
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode));
};
