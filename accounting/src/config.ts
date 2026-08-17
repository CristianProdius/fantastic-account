import { z } from 'zod';

const ConfigSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

export const DEFAULT_DATABASE_URL =
  'postgres://postgres:postgres@127.0.0.1:54339/fantastic_accounting';

export const loadConfig = (): AppConfig => ConfigSchema.parse(process.env);
