# Fantastic Account — agent instructions

Read this file before doing anything.

Mihail Popescu is the operator. He is not technical. After the project
is running, speak **Romanian**, short sentences. Do not ask him to type
Docker, pnpm, SQL, or git.

Cristian may also open this repo. Same rules.

---

## If he says “initiate”, “pornește”, “setup”, “instalează”, or this is a fresh clone

Do **not** ask him to install tools himself. You install and start the
project on this machine.

Follow **First-run (initiate)** below, then the everyday section.

Trigger phrases (any language): initiate, initialize, pornește proiectul,
instalează, setup, “hai să pornim”, first run, “nu am docker”.

---

## First-run (initiate)

Work only inside this repository. Never touch
`/Users/cristian/ProdiusEnterprise` or Postgres port **54329** if they exist
on this Mac.

### 0. Where you are

```bash
pwd
# must contain this repo (Fantastic Account / fantastic-account)
```

If the folder does not exist yet:

```bash
git clone git@github.com:CristianProdius/fantastic-account.git
cd fantastic-account
```

(HTTPS: `https://github.com/CristianProdius/fantastic-account.git`.)
If `gh` is logged in as another user, still clone **CristianProdius/fantastic-account**.

The repo is **private**. Mihail needs access from Cristian (GitHub invite).

### 1. Prerequisites — install what is missing

Check, then install. Prefer Homebrew on macOS.

| Tool | Why | Check | Install if missing |
|---|---|---|---|
| Docker Desktop | local Postgres | `docker info` | `brew install --cask docker` then open Docker.app and wait until it says running |
| Node 22+ | app runtime | `node -v` | `brew install node@22` |
| pnpm | package manager | `pnpm -v` | `corepack enable && corepack prepare pnpm@10 --activate` |
| Git | already used to clone | `git --version` | `brew install git` |

If Homebrew is missing:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

If Docker was just installed: open Docker Desktop, wait until the whale
is idle, then `docker info` must succeed. Do not continue while Docker
is starting.

You may also run the script (same steps, prints what it did):

```bash
bash scripts/initiate.sh
```

Tell Mihail in Romanian only what he must click (Docker Desktop icon,
GitHub login). You run the rest.

### 2. Start the books

```bash
cd accounting
cp -n .env.example .env
pnpm install
pnpm db:up
# wait until: docker exec fantastic-accounting-db-1 pg_isready -U postgres
pnpm db:setup          # first clone only
pnpm import:declarations
pnpm test
pnpm build
```

Postgres for this project is **only** `127.0.0.1:54339` /
`fantastic_accounting`. Tests use `fantastic_accounting_test`.

`pnpm db:setup` is for an **empty** first database. If declarations
already exist (`select count(*) from declarations` > 0), skip setup.
Safe later: `pnpm db:migrate`, `pnpm db:seed`, `pnpm import:declarations`.

### 3. Connect this folder to Claude / Grok / Codex

Generate MCP config with **this machine’s absolute path** (never leave
Cristian’s `/Users/cristian/Fantastic Account/...` on Mihail’s Mac):

```bash
REPO="$(cd "$(dirname "$0")/.." && pwd)"   # or: git rev-parse --show-toplevel
```

`scripts/initiate.sh` writes:

- `.mcp.json` in the repo root (Claude Code / Grok)
- prints the Claude Desktop and Codex snippets

**Claude Code:** `.mcp.json` is enough. Restart the session.

**Claude Desktop:** merge the printed `fantastic-accounting` server into
`~/Library/Application Support/Claude/claude_desktop_config.json`.
Do not delete other servers. Restart Claude Desktop.

**Codex:** merge the printed `[mcp_servers.fantastic-accounting]` block
into `~/.codex/config.toml`.

Then verify: “treci pe Fantastic” → “ce am de plătit luna asta?”.

### 4. After initiate succeeds

Say this to Mihail (Romanian, short):

```
Gata. Baza de date rulează pe calculatorul tău.
Spui cu ce firmă lucrezi: Global Fantastic sau Rare People.
Apoi poți întreba „ce am de plătit luna asta?”.
```

Then follow **Everyday** below. Do not keep talking about Docker.

---

## Companies

- `global-fantastic` — GLOBAL FANTASTIC S.R.L., IDNO 1022600056950, CAEM 7022
- `rare-people` — RARE PEOPLE S.R.L., IDNO 1024600014967, CAEM 8230

Both are **SIMM 4% + TVA** in the filed declarations. Not IT Park. Do not
apply IU17, MITP, or the 70% test.

## Everyday (after initiate)

Call `get_teacher`, then `get_onboarding_status`. Show what we already
know. Ask only missing questions. He may skip.

- “Ce am de plătit luna asta?” → `what_do_i_owe`
- “Treci pe …” → `switch_company`
- IBAN + banca → `save_onboarding_answer` (`bank_iban_mdl`) — upserts `bank_accounts`
- “Am pus extrasul” → `import_bank_folder`
- “Am pus fișierele din 1C” → `import_one_c_exports`
- “Închide luna” → `check_close_readiness`, then `set_period_status`

Files he drops:

- Bank: `companies/<slug>/02_Extrase_Bancare/`
- 1C Excel/CSV: `companies/<slug>/04_Export_1C/`
- Do not ask for another `.dt`. Backups stay in `03_Backup_1C/`.

## Isolation

See `AGENTS.md`. This ledger is not Prodius. Never use port 54329.
