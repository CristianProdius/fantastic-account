import { describe, expect, it } from 'vitest';
import { parseBankCsv } from '../../src/services/bank-import-service.js';

describe('parseBankCsv', () => {
  it('parses a simple dated amount csv', () => {
    const rows = parseBankCsv(
      ['date;description;amount;counterparty', '15.06.2026;Comision;100,00;MAIB'].join('\n'),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.bookingDate).toBe('2026-06-15');
    expect(rows[0]?.amount).toBe('100.00');
    expect(rows[0]?.fingerprint).toHaveLength(64);
  });

  it('returns empty for a header-only file', () => {
    expect(parseBankCsv('date;amount')).toEqual([]);
  });
});
