import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import type { AppDb } from '../db/client.js';
import { accounts, oneCExportFiles } from '../db/schema.js';
import {
  dateFromOneCFileName,
  parseCsvTrialBalance,
} from '../importers/one-c/parse-trial-balance.js';
import { oneCExportDir } from '../paths.js';
import { getCompany } from './company-service.js';
import { postBalancedEntry } from './journal-service.js';

export { parseCsvTrialBalance } from '../importers/one-c/parse-trial-balance.js';

const KEYWORDS: Array<[string, string]> = [
  ['balanta', 'trial_balance'],
  ['verificare', 'trial_balance'],
  ['jurnal', 'journal'],
  ['nota', 'journal'],
  ['conturi', 'chart'],
  ['plan', 'chart'],
  ['banca', 'bank'],
  ['extras', 'bank'],
  ['contrapart', 'counterparties'],
  ['salar', 'employees'],
];

export const classifyOneCFile = (fileName: string): string => {
  const lower = fileName.toLowerCase();
  for (const [keyword, kind] of KEYWORDS) {
    if (lower.includes(keyword)) return kind;
  }
  return 'unknown';
};

const money = (value: number) => value.toFixed(2);

export const importOneCExports = async (
  db: AppDb,
  companySlug: string,
  options?: { directory?: string },
) => {
  const { company } = await getCompany(db, companySlug);
  const directory = options?.directory ?? oneCExportDir(company.slug);
  let names: string[] = [];
  try {
    names = (await readdir(directory)).filter((name) =>
      ['.csv', '.xlsx', '.xls', '.txt'].includes(extname(name).toLowerCase()),
    );
  } catch {
    names = [];
  }

  if (names.length === 0) {
    return {
      companyId: company.slug,
      imported: 0,
      journals: 0,
      files: [],
      nextStep:
        'Nu am găsit fișiere în 04_Export_1C. Deschide 1C, salvează Balanța de verificare ca Excel/CSV și pune-o acolo. Vezi companies/_shared/ghid-export-1c.md',
    };
  }

  const chart = new Set((await db.select({ code: accounts.code }).from(accounts)).map((row) => row.code));
  let journals = 0;
  const files: Array<{ fileName: string; kind: string; note: string }> = [];

  for (const fileName of names) {
    const kind = classifyOneCFile(fileName);
    const filePath = join(directory, fileName);
    let note = `Fișier detectat ca ${kind}`;

    if (kind === 'trial_balance' && extname(fileName).toLowerCase() === '.csv') {
      const text = await readFile(filePath, 'utf8');
      const parsed = parseCsvTrialBalance(text);
      const known = parsed.filter((row) => chart.has(row.accountCode));
      const skipped = parsed
        .filter((row) => !chart.has(row.accountCode))
        .map((row) => row.accountCode);

      if (known.length >= 2) {
        const lines = known.flatMap((row) => {
          const out = [];
          if (row.debit > 0) {
            out.push({ accountCode: row.accountCode, debit: money(row.debit), credit: '0.00' });
          }
          if (row.credit > 0) {
            out.push({ accountCode: row.accountCode, debit: '0.00', credit: money(row.credit) });
          }
          return out;
        });
        const debit = lines.reduce((sum, line) => sum + Number(line.debit), 0);
        const credit = lines.reduce((sum, line) => sum + Number(line.credit), 0);
        const delta = Number((debit - credit).toFixed(2));
        if (Math.abs(delta) > 0.009 && chart.has('999')) {
          if (delta > 0) {
            lines.push({ accountCode: '999', debit: '0.00', credit: money(delta) });
          } else {
            lines.push({ accountCode: '999', debit: money(-delta), credit: '0.00' });
          }
        }

        const asOf = dateFromOneCFileName(fileName) ?? new Date().toISOString().slice(0, 10);
        try {
          const result = await postBalancedEntry(db, {
            companyId: company.slug,
            date: asOf,
            description: `1C balanta ${asOf}`,
            reference: `1c-balanta:${fileName}`,
            source: 'one_c_export',
            replace: true,
            lines,
          });
          if (result.created) journals += 1;
          note = `Importat ${known.length} conturi din balanța ${asOf}`;
          if (skipped.length > 0) {
            note += `. Sărite (nu sunt în plan): ${skipped.join(', ')}`;
          }
          if (Math.abs(delta) > 0.009) {
            note += `. Diferența ${money(Math.abs(delta))} MDL a mers pe 999`;
          }
        } catch (error) {
          note = `Balanța nu s-a putut posta: ${error instanceof Error ? error.message : String(error)}`;
        }
      } else {
        note =
          'CSV recunoscut ca balanță, dar nu am găsit cel puțin două conturi din plan (coloane cont + sold final debit/credit).';
      }
    } else if (extname(fileName).toLowerCase() === '.xlsx' || extname(fileName).toLowerCase() === '.xls') {
      note = 'Excel salvat. Îl indexăm. Pentru import automat, salvează și o copie CSV.';
    }

    await db
      .insert(oneCExportFiles)
      .values({
        companyId: company.slug,
        fileName,
        kind,
        filePath,
        note,
      })
      .onConflictDoUpdate({
        target: [oneCExportFiles.companyId, oneCExportFiles.fileName],
        set: { kind, filePath, note, importedAt: new Date() },
      });

    files.push({ fileName, kind, note });
  }

  return {
    companyId: company.slug,
    imported: files.length,
    journals,
    files,
    nextStep: null,
  };
};
