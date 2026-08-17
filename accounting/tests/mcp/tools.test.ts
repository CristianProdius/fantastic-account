import { describe, expect, it } from 'vitest';
import { callTool } from '../../src/mcp/tools.js';

describe('callTool', () => {
  it('refuses to run without a database', async () => {
    await expect(callTool('get_teacher', {})).rejects.toThrow(/DATABASE_URL/);
  });

  it('returns the teacher when a db handle is injected', async () => {
    const fakeDb = {} as never;
    const result = await callTool('get_teacher', {}, { db: fakeDb });
    expect(result).toMatchObject({ language: 'ro' });
  });
});
