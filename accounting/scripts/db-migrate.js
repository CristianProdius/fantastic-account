import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(__dirname, '../src/db/migrations');
const databaseUrl =
  process.env.DATABASE_URL ??
  'postgres://postgres:postgres@127.0.0.1:54339/fantastic_accounting';

if (databaseUrl.includes(':54329') || databaseUrl.includes('prodius_accounting')) {
  throw new Error('Refusing to migrate a Prodius DSN. Fantastic Account uses port 54339.');
}

const pool = new Pool({ connectionString: databaseUrl });

const main = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      create table if not exists app_migrations (
        file_name text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const appliedRows = await client.query('select file_name from app_migrations');
    const applied = new Set(appliedRows.rows.map((row) => row.file_name));
    const migrationFiles = (await readdir(migrationsDir))
      .filter((name) => name.endsWith('.sql'))
      .sort();

    for (const fileName of migrationFiles) {
      if (applied.has(fileName)) {
        console.log(`skip ${fileName}`);
        continue;
      }

      const sqlText = await readFile(resolve(migrationsDir, fileName), 'utf8');
      await client.query('begin');
      try {
        await client.query(sqlText);
        await client.query('insert into app_migrations (file_name) values ($1)', [fileName]);
        await client.query('commit');
        console.log(`applied ${fileName}`);
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
