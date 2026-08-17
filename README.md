# Fantastic Account

Accounting system for **Global Fantastic S.R.L.** and **Rare People S.R.L.**
Mihail Popescu talks to it through Claude, Grok, or Codex (MCP). Isolated
from Prodius Enterprise.

## Cristian — start once

```bash
cd "/Users/cristian/Fantastic Account/accounting"
cp .env.example .env
pnpm install
pnpm db:up
pnpm db:setup
pnpm import:declarations
pnpm test
pnpm build
```

Then add `accounting/dist/src/index.js` as MCP server `fantastic-accounting`
in Grok / Claude / Codex. See `mcp.json`.

Postgres: `127.0.0.1:54339` / `fantastic_accounting`.
Do not use port 54329.

## Mihail

Open Grok, Claude, or Codex and talk in Romanian. You do not need this README.
