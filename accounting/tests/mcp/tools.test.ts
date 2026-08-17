import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { callTool } from '../../src/mcp/tools.js';

const repoRoot = resolve(fileURLToPath(new URL('../../../', import.meta.url)));

describe('mcp.json install snippet', () => {
  it('points at Fantastic live Postgres, never Prodius', async () => {
    const config = JSON.parse(await readFile(resolve(repoRoot, 'mcp.json'), 'utf8')) as {
      mcpServers: Record<string, { command: string; args: string[]; env: { DATABASE_URL: string } }>;
    };
    const server = config.mcpServers['fantastic-accounting'];
    expect(server?.command).toBe('node');
    expect(server?.args[0]).toContain('/Fantastic Account/accounting/dist/src/index.js');
    expect(server?.env.DATABASE_URL).toBe(
      'postgres://postgres:postgres@127.0.0.1:54339/fantastic_accounting',
    );
    expect(server?.env.DATABASE_URL).not.toContain('54329');
    expect(server?.env.DATABASE_URL).not.toContain('prodius');
    expect(server?.env.DATABASE_URL).not.toMatch(/_test$/);
  });
});

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
