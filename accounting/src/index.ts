import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { startStdioServer } from './mcp/server.js';

export const config = loadConfig();

export const main = async () => {
  await startStdioServer();
};

const isEntrypoint =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];

if (isEntrypoint) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
