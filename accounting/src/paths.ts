import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const candidates = [
  resolve(here, '../..'), // src/ → repo
  resolve(here, '../../..'), // dist/src/ → repo
];

export const repoRoot =
  candidates.find((candidate) => existsSync(resolve(candidate, 'companies'))) ??
  candidates[0]!;

export const companyRoot = (slug: string) => resolve(repoRoot, 'companies', slug);

export const declarationsDir = (slug: string) => resolve(companyRoot(slug), '01_Declaratii');

export const bankDropDir = (slug: string) => resolve(companyRoot(slug), '02_Extrase_Bancare');

export const oneCExportDir = (slug: string) => resolve(companyRoot(slug), '04_Export_1C');
