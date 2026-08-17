import { and, eq } from 'drizzle-orm';
import type { AppDb } from '../db/client.js';
import { declarations, fiscalPeriods } from '../db/schema.js';
import { postBalancedEntry } from './journal-service.js';

const asNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: number) => value.toFixed(2);

const isoDate = (raw: string | null | undefined, fallback: string) => {
  if (!raw) return fallback;
  const match = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return fallback;
};

export const reconstructFromDeclarations = async (db: AppDb, companyId: string) => {
  const rows = await db.select().from(declarations).where(eq(declarations.companyId, companyId));
  let snapshots = 0;
  let taxes = 0;

  for (const row of rows) {
    const extracted = (row.extracted ?? {}) as Record<string, unknown>;

    if (row.formType === 'rsf1-presc' && row.year) {
      const assets = asNumber(extracted.totalAssets);
      const cash = asNumber(extracted.cash);
      const currentAssets = asNumber(extracted.currentAssets);
      const otherAssets = Math.max(assets - currentAssets, 0);
      const workingCapital = Math.max(currentAssets - cash, 0);
      const equityPlug = assets;

      if (assets > 0) {
        const date = isoDate(
          typeof extracted.asOf === 'string' ? extracted.asOf : null,
          `${row.year}-12-31`,
        );
        const assetLines = [
          ...(otherAssets > 0
            ? [{ accountCode: '123', debit: money(otherAssets), credit: '0.00' }]
            : []),
          ...(workingCapital > 0
            ? [{ accountCode: '221', debit: money(workingCapital), credit: '0.00' }]
            : []),
          ...(cash > 0 ? [{ accountCode: '2421', debit: money(cash), credit: '0.00' }] : []),
        ];
        const lines =
          assetLines.length > 0
            ? assetLines
            : [{ accountCode: '123', debit: money(assets), credit: '0.00' }];
        const result = await postBalancedEntry(db, {
          companyId,
          date,
          description: `RSF1 snapshot ${row.period ?? row.year}`,
          reference: `rsf1:${row.sfsId}`,
          source: 'snapshot',
          lines: [...lines, { accountCode: '332', debit: '0.00', credit: money(equityPlug) }],
        });
        if (result.created) snapshots += 1;
      }
    }

    if ((row.formType === 'simm24' || row.formType === 'simm20') && row.year) {
      const taxDue = asNumber(extracted.taxDue);
      if (taxDue > 0) {
        const result = await postBalancedEntry(db, {
          companyId,
          date: `${row.year}-12-31`,
          description: `SIMM ${row.period ?? row.year}`,
          reference: `simm:${row.sfsId}`,
          source: 'tax',
          lines: [
            { accountCode: '731', debit: money(taxDue), credit: '0.00' },
            { accountCode: '5342', debit: '0.00', credit: money(taxDue) },
          ],
        });
        if (result.created) taxes += 1;
      }
    }

    if (row.formType === 'tva12' && row.year && row.month) {
      const vat = asNumber(extracted.deductibleVat);
      if (vat > 0) {
        const date = `${row.year}-${String(row.month).padStart(2, '0')}-28`;
        const result = await postBalancedEntry(db, {
          companyId,
          date,
          description: `TVA12 deductible ${row.period}`,
          reference: `tva:${row.sfsId}`,
          source: 'tax',
          lines: [
            { accountCode: '225', debit: money(vat), credit: '0.00' },
            { accountCode: '713', debit: '0.00', credit: money(vat) },
          ],
        });
        if (result.created) taxes += 1;
      }
    }
  }

  await db
    .update(fiscalPeriods)
    .set({ status: 'locked' })
    .where(and(eq(fiscalPeriods.companyId, companyId)));

  // Re-open 2026 after the blanket lock.
  await db
    .update(fiscalPeriods)
    .set({ status: 'open' })
    .where(and(eq(fiscalPeriods.companyId, companyId), eq(fiscalPeriods.year, 2026)));

  return { snapshots, taxes, declarations: rows.length };
};
