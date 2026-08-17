import { describe, expect, it } from 'vitest';
import { TEST_DATABASE_URL } from './helpers.js';

describe('test database safety', () => {
  it('points at a *_test database on the Fantastic Account port', () => {
    const parsed = new URL(TEST_DATABASE_URL);
    expect(parsed.pathname.endsWith('_test')).toBe(true);
    expect(parsed.port).toBe('54339');
    expect(parsed.pathname).not.toContain('prodius');
  });
});
