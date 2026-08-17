import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createDb, type AppDb } from '../../src/db/client.js';

const helpersDir = dirname(fileURLToPath(import.meta.url));

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgres://postgres:postgres@127.0.0.1:54339/fantastic_accounting_test';

const assertSafeTestDatabase = (connectionString: string) => {
  const databaseName = new URL(connectionString).pathname.slice(1);
  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `Refusing to run destructive test setup against database "${databaseName}": ` +
        'test database names must end in "_test".',
    );
  }
  if (connectionString.includes(':54329') || connectionString.includes('prodius_accounting')) {
    throw new Error('Refusing to use the Prodius database for Fantastic Account tests.');
  }
};

assertSafeTestDatabase(TEST_DATABASE_URL);

let testDatabaseEnsured = false;

const ensureTestDatabaseExists = async () => {
  if (testDatabaseEnsured) return;
  const databaseName = new URL(TEST_DATABASE_URL).pathname.slice(1);
  const adminUrl = new URL(TEST_DATABASE_URL);
  adminUrl.pathname = '/postgres';
  const client = new pg.Client({ connectionString: adminUrl.toString() });
  await client.connect();
  try {
    const existing = await client.query('select 1 from pg_database where datname = $1', [
      databaseName,
    ]);
    if (existing.rowCount === 0) {
      await client.query(`create database "${databaseName.replaceAll('"', '""')}"`);
    }
  } finally {
    await client.end();
  }
  testDatabaseEnsured = true;
};

export const createTestDb = (): AppDb => createDb(TEST_DATABASE_URL);

export const resetTestDb = async (db: AppDb) => {
  assertSafeTestDatabase(TEST_DATABASE_URL);
  await ensureTestDatabaseExists();
  const migrationsDir = resolve(helpersDir, '../../src/db/migrations');
  const migrationFiles = (await readdir(migrationsDir))
    .filter((name) => name.endsWith('.sql'))
    .sort();
  const migrationSql = await Promise.all(
    migrationFiles.map((fileName) => readFile(resolve(migrationsDir, fileName), 'utf8')),
  );

  await db.$client.query(`
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;
  `);
  for (const sqlText of migrationSql) {
    await db.$client.query(sqlText);
  }
};
