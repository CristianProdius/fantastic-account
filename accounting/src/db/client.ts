import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { DEFAULT_DATABASE_URL, loadConfig } from '../config.js';
import * as schema from './schema.js';

export const createDb = (connectionString?: string) => {
  const config = loadConfig();
  const resolvedConnectionString =
    connectionString ?? config.DATABASE_URL ?? DEFAULT_DATABASE_URL;

  const pool = new Pool({
    connectionString: resolvedConnectionString,
  });

  pool.on('error', (error) => {
    console.error('postgres pool error:', error);
  });

  return drizzle(pool, { schema });
};

export type AppDb = ReturnType<typeof createDb>;
