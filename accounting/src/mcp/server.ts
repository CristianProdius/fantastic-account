import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { DEFAULT_DATABASE_URL } from '../config.js';
import { createDb } from '../db/client.js';
import { readResource } from './resources.js';
import { callTool } from './tools.js';

const toText = (value: unknown) => JSON.stringify(value, null, 2);

export const createServer = () => {
  if (!process.env.DATABASE_URL && !DEFAULT_DATABASE_URL) {
    throw new Error('DATABASE_URL is required to start fantastic-accounting');
  }

  const db = createDb();
  const server = new McpServer({
    name: 'fantastic-accounting',
    version: '0.1.0',
  });
  const run = (name: string, args: Record<string, unknown>) => callTool(name, args, { db });

  server.tool('get_teacher', {}, async () => ({
    content: [{ type: 'text', text: toText(await run('get_teacher', {})) }],
  }));

  server.tool('switch_company', { slug: z.string() }, async ({ slug }) => ({
    content: [{ type: 'text', text: toText(await run('switch_company', { slug })) }],
  }));

  server.tool(
    'get_onboarding_status',
    { companySlug: z.string().optional() },
    async ({ companySlug }) => ({
      content: [{ type: 'text', text: toText(await run('get_onboarding_status', { companySlug })) }],
    }),
  );

  server.tool(
    'save_onboarding_answer',
    {
      questionKey: z.string(),
      value: z.string().optional(),
      skip: z.boolean().optional(),
      companySlug: z.string().optional(),
    },
    async (args) => ({
      content: [{ type: 'text', text: toText(await run('save_onboarding_answer', args)) }],
    }),
  );

  server.tool(
    'complete_onboarding',
    { companySlug: z.string().optional() },
    async ({ companySlug }) => ({
      content: [{ type: 'text', text: toText(await run('complete_onboarding', { companySlug })) }],
    }),
  );

  server.tool(
    'import_declarations',
    { companySlug: z.string().optional() },
    async ({ companySlug }) => ({
      content: [{ type: 'text', text: toText(await run('import_declarations', { companySlug })) }],
    }),
  );

  server.tool(
    'import_one_c_exports',
    { companySlug: z.string().optional() },
    async ({ companySlug }) => ({
      content: [{ type: 'text', text: toText(await run('import_one_c_exports', { companySlug })) }],
    }),
  );

  server.tool(
    'import_bank_folder',
    { companySlug: z.string().optional(), iban: z.string().optional() },
    async (args) => ({
      content: [{ type: 'text', text: toText(await run('import_bank_folder', args)) }],
    }),
  );

  server.tool(
    'what_do_i_owe',
    {
      year: z.number().int().optional(),
      month: z.number().int().min(1).max(12).optional(),
      companySlug: z.string().optional(),
    },
    async (args) => ({
      content: [{ type: 'text', text: toText(await run('what_do_i_owe', args)) }],
    }),
  );

  server.tool(
    'list_declarations',
    {
      formType: z.string().optional(),
      year: z.number().int().optional(),
      companySlug: z.string().optional(),
    },
    async (args) => ({
      content: [{ type: 'text', text: toText(await run('list_declarations', args)) }],
    }),
  );

  server.tool(
    'set_period_status',
    {
      year: z.number().int(),
      month: z.number().int().min(1).max(12),
      status: z.enum(['open', 'closed', 'locked']),
      companySlug: z.string().optional(),
    },
    async (args) => ({
      content: [{ type: 'text', text: toText(await run('set_period_status', args)) }],
    }),
  );

  server.tool(
    'check_close_readiness',
    {
      year: z.number().int(),
      month: z.number().int().min(1).max(12),
      companySlug: z.string().optional(),
    },
    async (args) => ({
      content: [{ type: 'text', text: toText(await run('check_close_readiness', args)) }],
    }),
  );

  server.resource('session://active-company', 'session://active-company', async (uri) => ({
    contents: [{ uri: uri.href, text: toText(await readResource(uri.href, { db })) }],
  }));

  return { server, db };
};

export const startStdioServer = async () => {
  const { server } = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
};
