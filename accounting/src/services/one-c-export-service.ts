import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import type { AppDb } from '../db/client.js';
import { oneCExportFiles } from '../db/schema.js';
import { oneCExportDir } from '../paths.js';
import { getCompany } from './company-service.js';
import { postBalancedEntry } from './journal-service.js';

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

const parseCsvTrialBalance = (text: string) => {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const rows: Array<{ accountCode: string; debit: number; credit: number }> = [];
  for (const line of lines) {
    const parts = line.split(/[;,]/).map((part) => part.trim().replace(/^"|"$/g, ''));
    if (parts.length < 3) continue;
    const accountCode = parts[0] ?? '';
    if (!/^\d{3,5}$/.test(accountCode)) continue;
    const debit = Number((parts[1] ?? '0').replace(/\s/g, '').replace(',', '.'));
    const credit = Number((parts[2] ?? '0').replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(debit) || !Number.isFinite(credit)) continue;
    if (debit === 0 && credit === 0) continue;
    rows.push({ accountCode, debit, credit });
  }
  return rows;
};

export const importOneCExports = async (db: AppDb, companySlug: string) => {
  const { company } = await getCompany(db, companySlug);
  const directory = oneCExportDir(company.slug);
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

  let journals = 0;
  const files: Array<{ fileName: string; kind: string; note: string }> = [];

  for (const fileName of names) {
    const kind = classifyOneCFile(fileName);
    const filePath = join(directory, fileName);
    let note = `Fișier detectat ca ${kind}`;

    if (kind === 'trial_balance' && extname(fileName).toLowerCase() === '.csv') {
      const text = await readFile(filePath, 'utf8');
      const rows = parseCsvTrialBalance(text);
      const usable = rows.filter((row) => ['123', '221', '2421', '332', '5342', '731', '611', '713', '225', '311', '521', '531', '533'].includes(row.accountCode));
      if (usable.length >= 2) {
        const lines = usable.flatMap((row) => {
          const out = [];
          if (row.debit > 0) {
            out.push({ accountCode: row.accountCode, debit: row.debit.toFixed(2), credit: '0.00' });
          }
          if (row.credit > 0) {
            out.push({ accountCode: row.accountCode, debit: '0.00', credit: row.credit.toFixed(2) });
          }
          return out;
        });
        try {
          const result = await postBalancedEntry(db, {
            companyId: company.slug,
            date: new Date().toISOString().slice(0, 10),
            description: `1C balanta ${fileName}`,
            reference: `1c-balanta:${fileName}`,
            source: 'one_c_export',
            lines,
          });
          if (result.created) journals += 1;
          note = `Importat ${usable.length} rânduri din balanță`;
        } catch (error) {
          note = `Balanța nu s-a putut posta: ${error instanceof Error ? error.message : String(error)}`;
        }
      } else {
        note = 'CSV recunoscut ca balanță, dar coloanele nu sunt cont/debit/credit. Lasă-l aici, îl citim manual.';
      }
    } else if (extname(fileName).toLowerCase() === '.xlsx') {
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
