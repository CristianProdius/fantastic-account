import { describe, expect, it } from 'vitest';
import {
  dateFromOneCFileName,
  normalizeAccountCode,
  parseCsvTrialBalance,
} from '../../src/importers/one-c/parse-trial-balance.js';

describe('parseCsvTrialBalance', () => {
  it('reads a 1C headered balanță using sold final columns', () => {
    const rows = parseCsvTrialBalance(
      [
        '\uFEFFCont;Denumirea contului;Sold inițial Dt;Sold inițial Ct;Rulaj Dt;Rulaj Ct;Sold final Dt;Sold final Ct',
        '221;Creanțe;100,00;0;50,00;0;1500,00;0,00',
        '242.1;Cont curent;0;0;0;0;8000,00;0,00',
        '521;Furnizori;0;200;0;0;0,00;9500,00',
        '88888;Necunoscut;0;0;0;0;1,00;0,00',
      ].join('\n'),
    );
    expect(rows).toEqual([
      { accountCode: '221', debit: 1500, credit: 0 },
      { accountCode: '2421', debit: 8000, credit: 0 },
      { accountCode: '521', debit: 0, credit: 9500 },
      { accountCode: '88888', debit: 1, credit: 0 },
    ]);
  });

  it('reads a headerless cont;debit;credit file', () => {
    expect(parseCsvTrialBalance('2421;100,00;0\n521;0;100,00')).toEqual([
      { accountCode: '2421', debit: 100, credit: 0 },
      { accountCode: '521', debit: 0, credit: 100 },
    ]);
  });
});

describe('dateFromOneCFileName', () => {
  it('pulls the as-of date from common 1C export names', () => {
    expect(dateFromOneCFileName('Balanta_de_verificare_2025-12-31.csv')).toBe('2025-12-31');
    expect(dateFromOneCFileName('balanta_31.12.2025.csv')).toBe('2025-12-31');
    expect(dateFromOneCFileName('Balanta_2025.csv')).toBe('2025-12-31');
    expect(dateFromOneCFileName('jurnal.csv')).toBeNull();
  });
});

describe('normalizeAccountCode', () => {
  it('strips 1C dotted subaccounts', () => {
    expect(normalizeAccountCode('242.1')).toBe('2421');
    expect(normalizeAccountCode('534.2')).toBe('5342');
    expect(normalizeAccountCode('abc')).toBeNull();
  });
});
