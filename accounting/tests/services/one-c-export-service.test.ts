import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { accounts, companies, journalEntries, journalLines, taxProfiles } from '../../src/db/schema.js';
import { seedAccounts, seedCompanies, seedTaxProfiles } from '../../src/db/seed.js';
import { classifyOneCFile, importOneCExports } from '../../src/services/one-c-export-service.js';
import { getTrialBalance } from '../../src/services/journal-service.js';
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

describe('classifyOneCFile', () => {
  it('maps Romanian export names to kinds', () => {
    expect(classifyOneCFile('Balanta_de_verificare_2025.xlsx')).toBe('trial_balance');
    expect(classifyOneCFile('registru-jurnal.csv')).toBe('journal');
    expect(classifyOneCFile('plan_de_conturi.xlsx')).toBe('chart');
    expect(classifyOneCFile('extras_banca_mai.csv')).toBe('bank');
    expect(classifyOneCFile('lista_contraparti.xlsx')).toBe('counterparties');
    expect(classifyOneCFile('salariati.xlsx')).toBe('employees');
    expect(classifyOneCFile('random.pdf')).toBe('unknown');
  });
});

describe('importOneCExports', () => {
  beforeEach(async () => {
    await resetTestDb(db);
    await seedMinimum();
  });

  afterAll(async () => {
    await db.$client.end();
  });

  it('posts a headered 1C CSV trial balance and replaces on re-import', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fa-1c-'));
    const fileName = 'Balanta_de_verificare_2025-12-31.csv';
    await writeFile(
      join(directory, fileName),
      [
        'Cont;Denumirea contului;Sold inițial Dt;Sold inițial Ct;Rulaj Dt;Rulaj Ct;Sold final Dt;Sold final Ct',
        '221;Creanțe;0;0;0;0;1500,00;0,00',
        '242.1;Cont curent;0;0;0;0;8000,00;0,00',
        '311;Capital;0;0;0;0;0,00;1000,00',
        '521;Furnizori;0;0;0;0;0,00;8500,00',
        '88888;Necunoscut;0;0;0;0;99,00;0,00',
      ].join('\n'),
    );

    const first = await importOneCExports(db, 'global-fantastic', { directory });
    expect(first.imported).toBe(1);
    expect(first.journals).toBe(1);
    expect(first.files[0]?.note).toMatch(/2025-12-31/);
    expect(first.files[0]?.note).toMatch(/88888/);

    const trial = await getTrialBalance(db, 'global-fantastic');
    expect(trial.find((row) => row.accountCode === '2421')?.debit).toBe(8000);
    expect(trial.find((row) => row.accountCode === '521')?.credit).toBe(8500);
    expect(trial.find((row) => row.accountCode === '88888')).toBeUndefined();

    const [entry] = await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.reference, `1c-balanta:${fileName}`));
    expect(entry?.description).toBe('1C balanta 2025-12-31');
    expect(entry?.date).toBe('2025-12-31');

    await writeFile(
      join(directory, fileName),
      ['2421;2000,00;0', '521;0;2000,00'].join('\n'),
    );
    const second = await importOneCExports(db, 'global-fantastic', { directory });
    expect(second.journals).toBe(1);

    const entries = await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.companyId, 'global-fantastic'));
    expect(entries).toHaveLength(1);
    const replaced = await getTrialBalance(db, 'global-fantastic');
    expect(replaced.find((row) => row.accountCode === '2421')?.debit).toBe(2000);
    expect(replaced.find((row) => row.accountCode === '221')).toBeUndefined();
  });

  it('plugs an unbalanced balanță onto 999 and leaves an empty live folder alone', async () => {
    const empty = await importOneCExports(db, 'rare-people');
    expect(empty.imported).toBe(0);
    expect(empty.nextStep).toMatch(/04_Export_1C/);

    const directory = await mkdtemp(join(tmpdir(), 'fa-1c-unbal-'));
    await writeFile(join(directory, 'balanta_2025.csv'), '2421;100,00;0\n221;50,00;0\n');
    const imported = await importOneCExports(db, 'rare-people', { directory });
    expect(imported.journals).toBe(1);
    expect(imported.files[0]?.note).toMatch(/999/);

    const lines = await db.select().from(journalLines);
    expect(lines.some((line) => line.accountCode === '999' && Number(line.credit) === 150)).toBe(true);
  });
});
