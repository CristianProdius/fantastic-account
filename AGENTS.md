# Agent guardrails — Fantastic Account

This system is the accounting backend for **GLOBAL FANTASTIC S.R.L.** and
**RARE PEOPLE S.R.L.** (administrator: Mihail Popescu). It is a sibling of
Prodius accounting. Treat the two as unrelated machines.

## CRITICAL: never touch Prodius

Do not open, migrate, compose, query, or delete anything under
`/Users/cristian/ProdiusEnterprise`, including:

- `prodius-accounting` Docker containers or the `prodius_accounting_pgdata` volume
- Postgres on port **54329**
- database `prodius_accounting`

This project's database is `fantastic_accounting` on port **54339**.

## CRITICAL: never wipe the live ledger

### Commands you MUST NEVER run without an explicit in-message human approval

- `docker compose down -v` (the `-v` removes `fantastic_accounting_pgdata`)
- `docker volume rm` against any `fantastic*` volume
- `DROP DATABASE fantastic_accounting`
- `DROP SCHEMA public CASCADE` against the live DSN
- `TRUNCATE` / unbounded `DELETE` on `journal_*`, `declarations`, `bank_*`
- `pnpm db:setup` against an already-populated live DB
- Any drizzle push that would drop columns

### Tests

`pnpm test` drops the schema of the **test** database only.
`TEST_DATABASE_URL` must name a database ending in `_test`.
Default: `postgres://postgres:postgres@127.0.0.1:54339/fantastic_accounting_test`.
Never point tests at `fantastic_accounting`.

### Commands that ARE safe

- `pnpm db:migrate`
- `pnpm db:seed` (idempotent upserts)
- `pnpm import:declarations` (upsert by SFS id)
- `docker compose up -d` / `stop` / `start` (no `-v`, no `rm`)

## If you think you need to wipe

1. Stop. Ask the human, with the exact command.
2. Snapshot first:
   ```bash
   docker exec fantastic-accounting-db-1 \
     pg_dump -U postgres -d fantastic_accounting -Fc \
     > /tmp/fantastic_accounting_$(date +%Y%m%d_%H%M%S).dump
   ```
3. Only then proceed, and only with an explicit yes.
