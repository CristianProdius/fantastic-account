# Fantastic Account

Accounting for **GLOBAL FANTASTIC S.R.L.** and **RARE PEOPLE S.R.L.**
Mihail Popescu talks to it in Romanian through Claude, Grok, or Codex (MCP).

This is a **sibling** of Prodius accounting. Separate folder, Docker volume,
Postgres port, and database. Never mix them.

| | Fantastic Account | Prodius (do not touch) |
|---|---|---|
| Folder | `/Users/cristian/Fantastic Account/` | `/Users/cristian/ProdiusEnterprise/` |
| Postgres | `127.0.0.1:54339` | `127.0.0.1:54329` |
| Database | `fantastic_accounting` | `prodius_accounting` |
| MCP name | `fantastic-accounting` | `prodius-accounting` |

## Cristian — start once

Needs Docker, Node 22, pnpm. Mihail never runs these.

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

Leave the container running (`fantastic-accounting-db-1` on **54339**).
After code changes, run `pnpm build` again — MCP loads `dist/`, not `src/`.

Safe later: `pnpm db:migrate`, `pnpm db:seed`, `pnpm import:declarations`,
`docker compose up -d` / `stop` / `start`.

Never: `docker compose down -v`, drop `fantastic_accounting`, or any command
against port **54329** / `prodius_accounting`. Tests use
`fantastic_accounting_test` only.

## Cristian — add the MCP server

Snippet: [`mcp.json`](mcp.json). Merge it. Do **not** replace a file that
already has other servers (for example `prodius-accounting`).

`DATABASE_URL` in the snippet is the **live** ledger (`fantastic_accounting`
on 54339). Never point MCP at `*_test` or at 54329.

### Claude Desktop (macOS)

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`.
Add the `fantastic-accounting` block from `mcp.json` next to any existing
servers. Restart Claude Desktop.

### Claude Code

Copy `mcp.json` to `.mcp.json` in this repo (same shape), or merge the
`fantastic-accounting` server into an existing `.mcp.json`. Restart the
session. Do not remove `prodius-accounting` if it is already listed
elsewhere — they are different servers.

### Codex

In `~/.codex/config.toml`:

```toml
[mcp_servers.fantastic-accounting]
command = "node"
args = ["/Users/cristian/Fantastic Account/accounting/dist/src/index.js"]

[mcp_servers.fantastic-accounting.env]
DATABASE_URL = "postgres://postgres:postgres@127.0.0.1:54339/fantastic_accounting"
```

### Grok

Open Grok MCP / connectors settings and paste `mcp.json` (or merge the
`fantastic-accounting` server). Restart Grok.

### Check it worked

In a new chat: “treci pe Fantastic” then “ce am de plătit luna asta?”.
If the server cannot start, confirm Docker is up and `pnpm build` was run.

## Mihail

Open Grok, Claude, or Codex. Talk in Romanian. You do not need this README.

- „Treci pe Fantastic” / „Treci pe Rare People”
- „Ce am de plătit luna asta?”
- IBAN + banca (onboarding) — then extras CSV into `02_Extrase_Bancare/`
- Export 1C Excel into `04_Export_1C/` (see `companies/_shared/ghid-export-1c.md`)
- „Închide luna”

## Folders

- `companies/global-fantastic/` and `companies/rare-people/`
- `01_Declaratii/` — SFS XML/PDF (already imported)
- `02_Extrase_Bancare/` — bank CSV (empty until Mihail drops files)
- `03_Backup_1C/` — sealed `.dt` backups, not parsed
- `04_Export_1C/` — optional 1C Excel/CSV
