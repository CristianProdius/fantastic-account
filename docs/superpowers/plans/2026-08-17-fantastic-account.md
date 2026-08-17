# Fantastic Account Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Isolated multi-company Moldova accounting engine for Global Fantastic and Rare People, with declaration history imported, conversational onboarding, and an MCP interface Mihail can use from Grok/Claude/Codex.

**Architecture:** Sibling of Prodius accounting, not a fork that shares runtime. One Postgres (port 54339) with `company_id` on operational tables. XML declaration importer reconstructs historical snapshots. Optional 1C Excel drop-folder. MCP is the only user interface.

**Tech Stack:** TypeScript, Node 22, pnpm, Postgres 16, Drizzle, Vitest, MCP SDK, Zod. Docker Compose only for this project's database.

**Isolation:** Never open, migrate, or compose against `/Users/cristian/ProdiusEnterprise` or port 54329.

**Continue-work file:** `docs/superpowers/plans/LOOP.md` — the scheduled loop reads this plan and LOOP.md to pick the next unchecked task.

---

## File map

- `AGENTS.md`, `CLAUDE.md`, `README.md` — isolation + Mihail-facing agent rules
- `companies/_shared/ghid-export-1c.md` — Romanian 1C export clicks
- `accounting/src/db/schema.ts` + `migrations/0001_init.sql`
- `accounting/src/importers/declarations/parse-xml.ts` — pure XML parser
- `accounting/src/services/declaration-import-service.ts`
- `accounting/src/services/snapshot-journal-service.ts`
- `accounting/src/services/tax-due-service.ts`
- `accounting/src/services/onboarding-service.ts`
- `accounting/src/services/company-service.ts`
- `accounting/src/services/teacher.ts`
- `accounting/src/services/one-c-export-service.ts`
- `accounting/src/services/journal-service.ts`
- `accounting/src/mcp/server.ts`, `tools.ts`, `resources.ts`
- `accounting/scripts/import-declarations.ts`, `db-migrate.js`, `db-seed.js`

---

### Task 1: Isolated project skeleton

**Files:**
- Create: `AGENTS.md`, `CLAUDE.md`, `README.md`, `.gitignore`
- Create: `accounting/package.json`, `tsconfig.json`, `vitest.config.ts`, `drizzle.config.ts`, `docker-compose.yml`, `.env.example`

- [x] Create the files listed. Postgres image `postgres:16`, port **54339:5432**, db/user/password `fantastic_accounting` / `postgres` / `postgres`, volume `fantastic_accounting_pgdata`. Default `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54339/fantastic_accounting`.
- [x] `AGENTS.md` must forbid `docker compose down -v`, `DROP DATABASE fantastic_accounting`, and any command against Prodius port 54329 or `prodius_accounting`.
- [ ] Commit: `chore: scaffold isolated Fantastic Account project`

### Task 2: Declaration XML parser (pure, no DB)

**Files:**
- Create: `accounting/src/importers/declarations/parse-xml.ts`
- Test: `accounting/tests/importers/parse-xml.test.ts`

- [x] Write failing tests for SIMM24, TVA12, RSF1-presc, IPC21 using the real XML files under `companies/*/01_Declaratii/xml/`.
- [x] Parser returns `{ formType, fiscalCode, companyName, period, year, month, extracted }`.
- [x] SIMM24 extracted includes `taxableBase`, `rate`, `taxDue` as numbers.
- [x] TVA12 extracted includes `deductibleBase` (`ndsSum7t`) and `deductibleVat` (`sum7t`).
- [x] Period `L/06/2026` → year 2026, month 6; `A/2025` → year 2025, month null.
- [ ] Commit: `feat: parse SFS declaration XML`

### Task 3: Schema, migrate, seed companies

**Files:**
- Create: `accounting/src/db/schema.ts`, `client.ts`, `seed.ts`
- Create: `accounting/src/db/migrations/0001_init.sql`
- Create: `accounting/scripts/db-migrate.js`, `db-seed.js`
- Test: `accounting/tests/db/helpers.ts`, `accounting/tests/db/seed.test.ts`

- [x] Tables as in the spec. `accounts.code` is global. Journal/periods/banks/declarations/employees/onboarding all have `company_id`.
- [x] Seed two companies and tax profiles from declaration facts. Seed shared chart (221, 2421, 521, 531, 533, 5341 TVA, 5342 SIMM, 611, 713, 731, 311 capital, 332 retained earnings, 523 other payables).
- [x] Tests refuse any `TEST_DATABASE_URL` whose database name does not end in `_test`. Default test DSN port **54339** / `fantastic_accounting_test`.
- [ ] Commit: `feat: multi-company schema and seed`

### Task 4: Import declarations into Postgres

**Files:**
- Create: `accounting/src/services/declaration-import-service.ts`
- Create: `accounting/scripts/import-declarations.ts`
- Test: `accounting/tests/services/declaration-import-service.test.ts`

- [x] Walk `companies/<slug>/01_Declaratii/{xml,pdf}`, upsert by `(company_id, sfs_id)` where `sfs_id` is the filename stem.
- [x] Store extracted JSON and file paths. Idempotent on re-run.
- [x] Test against the real Rare People SIMM24 2025 file (taxDue ≈ 23289.07).
- [ ] Commit: `feat: import SFS declaration packs`

### Task 5: Snapshot journals + tax facts from declarations

**Files:**
- Create: `accounting/src/services/snapshot-journal-service.ts`
- Create: `accounting/src/services/journal-service.ts`
- Test: `accounting/tests/services/snapshot-journal-service.test.ts`

- [x] For each imported RSF1, post one balanced snapshot entry dated as-of, description `RSF1 snapshot A/YYYY`, source `tax`.
- [x] For each SIMM24, post Dr 731 / Cr 5342 for `taxDue`.
- [x] Lock fiscal periods for years < 2026 after snapshots. Leave 2026 open.
- [x] Re-run is idempotent (same reference skips).
- [ ] Commit: `feat: reconstruct books from RSF1 and SIMM`

### Task 6: What do I owe + onboarding + teacher

**Files:**
- Create: `accounting/src/services/tax-due-service.ts`
- Create: `accounting/src/services/onboarding-service.ts`
- Create: `accounting/src/services/teacher.ts`
- Create: `accounting/src/services/company-service.ts`
- Test: `accounting/tests/services/tax-due-service.test.ts`
- Test: `accounting/tests/services/onboarding-service.test.ts`

- [x] `whatDoIOwe(company, year, month)` returns VAT (from last TVA12 or open estimate), SIMM YTD/annual, Fantastic payroll/IPC21 if employees exist, and any pending onboarding gaps.
- [x] Onboarding lists the 9 spec questions, prefills regime, accepts skip, never blocks other tools.
- [x] `getTeacher()` returns the exact Romanian script from the spec.
- [ ] Commit: `feat: dues, onboarding, teacher`

### Task 7: 1C export drop-folder

**Files:**
- Create: `companies/_shared/ghid-export-1c.md`
- Create: `accounting/src/services/one-c-export-service.ts`
- Test: `accounting/tests/services/one-c-export-service.test.ts`

- [x] Detect `.xlsx/.xls/.csv` in `04_Export_1C/`. Record each file. Classify by filename keywords (`balanta`, `jurnal`, `conturi`, `banca`, `contrapart`, `salar`).
- [x] If a trial-balance sheet has account code + debit/credit columns, post/replace a snapshot journal `1C balanta YYYY-MM-DD`.
- [x] Missing files return a Romanian next-step from the ghid, not an error.
- [ ] Commit: `feat: optional 1C Excel import`

### Task 8: MCP server

**Files:**
- Create: `accounting/src/mcp/server.ts`, `tools.ts`, `resources.ts`
- Create: `accounting/src/index.ts`, `accounting/src/config.ts`
- Test: `accounting/tests/mcp/tools.test.ts`

- [x] Implement the v1 tool/resource list from the spec. Tools require `DATABASE_URL` via injected `db`.
- [x] `switch_company` writes `agent_session`. Subsequent tools default to that company.
- [ ] Commit: `feat: MCP interface for Mihail`

### Task 9: Bank folder import (statements when they exist)

**Files:**
- Create: `accounting/src/importers/bank/parse-csv.ts`
- Create: `accounting/src/services/bank-import-service.ts`
- Test: `accounting/tests/importers/parse-csv.test.ts`

- [x] Import CSV/Excel dropped in `02_Extrase_Bancare/`. Dedup by `(company_id, bank_iban, fingerprint)`.
- [x] Unclassified transactions stay in a review list exposed as an MCP resource.
- [ ] Commit: `feat: bank statement drop-folder import`

### Task 10: Month close checklist

**Files:**
- Create: `accounting/src/services/month-close-service.ts`
- Test: `accounting/tests/services/month-close-service.test.ts`

- [x] Per company, ensure obligation instances for the month (TVA always; IPC21 if employees; SIMM only in December as YTD reminder plus annual instance in March).
- [x] `check_close_readiness` fails if unclassified bank txns or pending required obligations exist.
- [x] Commit: `test: Fantastic June 2026 dues and month-close`

### Task 11: Wire MCP configs + identity notes

**Files:**
- Create: `mcp.json` (Claude/Grok snippet)
- Create: `companies/rare-people/00_Identitate/COMPANIE.md`
- Create: `companies/global-fantastic/00_Identitate/COMPANIE.md`

- [x] Document how Cristian adds the server to Grok/Claude/Codex. Mihail never runs a command.
- [ ] Commit: `docs: MCP install notes and company identity`

---

## Spec coverage

| Spec section | Task |
|---|---|
| Isolation / Docker port | 1 |
| Declaration parse + import | 2, 4 |
| Historical RSF1/SIMM journals | 5 |
| Tax engine + what do I owe | 6, 10 |
| Onboarding + teacher | 6 |
| 1C Excel step | 7 |
| MCP | 8, 11 |
| Bank going forward | 9 |
| Company identity files | 11 |

## Loop contract

A scheduled loop may implement the next unchecked task only. It must:

1. Work only under `/Users/cristian/Fantastic Account/`.
2. Leave ProdiusEnterprise untouched.
3. Run `pnpm test` in `accounting/` before claiming a task done.
4. Update checkboxes in this file and write a 5-line note to `LOOP.md`.
5. Stop if tests fail twice on the same task.
