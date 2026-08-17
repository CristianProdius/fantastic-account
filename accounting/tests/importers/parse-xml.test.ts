import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseDeclarationXml, parsePeriod } from '../../src/importers/declarations/parse-xml.js';

const repoRoot = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const rpXml = (name: string) =>
  resolve(repoRoot, 'companies/rare-people/01_Declaratii/xml', name);
const gfXml = (name: string) =>
  resolve(repoRoot, 'companies/global-fantastic/01_Declaratii/xml', name);

describe('parsePeriod', () => {
  it('parses annual, monthly, quarter and semester tags', () => {
    expect(parsePeriod('A/2025')).toEqual({ period: 'A/2025', year: 2025, month: null });
    expect(parsePeriod('L/06/2026')).toEqual({ period: 'L/06/2026', year: 2026, month: 6 });
    expect(parsePeriod('T/3/2024')).toEqual({ period: 'T/3/2024', year: 2024, month: 9 });
    expect(parsePeriod('S/1/2026')).toEqual({ period: 'S/1/2026', year: 2026, month: 6 });
  });
});

describe('parseDeclarationXml', () => {
  it('parses Rare People SIMM24 2025 tax due', async () => {
    const xml = await readFile(rpXml('27680832.xml'), 'utf8');
    const parsed = parseDeclarationXml(xml);
    expect(parsed.formType).toBe('simm24');
    expect(parsed.fiscalCode).toBe('1024600014967');
    expect(parsed.year).toBe(2025);
    expect(parsed.extracted.rate).toBe(4);
    expect(parsed.extracted.taxDue).toBe(23289.07);
    expect(parsed.extracted.taxableBase).toBe(582226.83);
  });

  it('parses Rare People TVA12 February 2025', async () => {
    const xml = await readFile(rpXml('24162511.xml'), 'utf8');
    const parsed = parseDeclarationXml(xml);
    expect(parsed.formType).toBe('tva12');
    expect(parsed.year).toBe(2025);
    expect(parsed.month).toBe(2);
    expect(parsed.extracted.deductibleBase).toBe(8497.95);
    expect(parsed.extracted.deductibleVat).toBe(1699.59);
  });

  it('parses Rare People RSF1 2025 totals', async () => {
    const xml = await readFile(rpXml('26769770.xml'), 'utf8');
    const parsed = parseDeclarationXml(xml);
    expect(parsed.formType).toBe('rsf1-presc');
    expect(parsed.extracted.totalAssets).toBe(309883);
    expect(parsed.extracted.responsible).toBe('POPESCU MIHAIL');
  });

  it('parses Global Fantastic IPC21 employees', async () => {
    const xml = await readFile(gfXml('23748320.xml'), 'utf8');
    const parsed = parseDeclarationXml(xml);
    expect(parsed.formType).toBe('ipc21');
    expect(parsed.year).toBe(2024);
    expect(parsed.month).toBe(12);
    const people = parsed.extracted.employees as Array<{ name: string }>;
    expect(people.map((person) => person.name)).toContain('POPESCU MIHAIL');
  });
});
