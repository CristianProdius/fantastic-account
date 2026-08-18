# Fantastic Account

Contabilitate pentru **GLOBAL FANTASTIC S.R.L.** și **RARE PEOPLE S.R.L.**
Repo **privat**. Mihail vorbește cu Claude / Grok / Codex în română.

## Mihail — ce faci tu

1. Cristian te invită pe GitHub la acest repo.
2. Pe Mac: instalează [Claude](https://claude.ai/download) (sau Grok / Codex).
3. Clonează repo-ul (Claude poate face asta) într-un folder al tău, de exemplu Desktop.
4. Deschide folderul în Claude și scrie exact:

```
Pornește proiectul. Citește CLAUDE.md și fă initiate.
```

Tu nu instalezi Postgres cu mâna. Claude instalează Docker Desktop și
Node dacă lipsesc, pornește baza, importă declarațiile, și leagă MCP.
Dacă trebuie să apeși pe ceva (Docker Desktop, login GitHub), îți spune
în română.

După aia, în chat:

- „Treci pe Fantastic” / „Treci pe Rare People”
- „Ce am de plătit luna asta?”
- IBAN + banca
- pui extrasul CSV în `companies/<firma>/02_Extrase_Bancare/`
- pui exportul 1C Excel în `companies/<firma>/04_Export_1C/`
- „Închide luna”

Ghid 1C: `companies/_shared/ghid-export-1c.md`.

## Agent — first run

Read `CLAUDE.md`. Command: `bash scripts/initiate.sh`.

This project is **not** Prodius. Postgres **54339** /
`fantastic_accounting` only. Never port 54329.

| | This repo | Prodius (ignore / do not touch) |
|---|---|---|
| Postgres | `127.0.0.1:54339` | `127.0.0.1:54329` |
| Database | `fantastic_accounting` | `prodius_accounting` |
| MCP | `fantastic-accounting` | `prodius-accounting` |

After initiate, leave `fantastic-accounting-db-1` running. Rebuild MCP
with `pnpm build` in `accounting/` after code changes.

Never: `docker compose down -v`, drop `fantastic_accounting`, or any
command against 54329.

## Folders

- `companies/global-fantastic/` and `companies/rare-people/`
- `01_Declaratii/` — SFS XML/PDF (imported on first run)
- `02_Extrase_Bancare/` — bank CSV (empty until dropped)
- `03_Backup_1C/` — sealed `.dt` backups, not parsed
- `04_Export_1C/` — optional 1C Excel/CSV
