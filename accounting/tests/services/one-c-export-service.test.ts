import { describe, expect, it } from 'vitest';
import { classifyOneCFile } from '../../src/services/one-c-export-service.js';

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
