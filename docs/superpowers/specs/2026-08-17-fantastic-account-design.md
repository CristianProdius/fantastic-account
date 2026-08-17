# Fantastic Account — Design Spec

Date: 2026-08-17
Status: approved for implementation (user: isolated sibling, no wait, implement now)

## Problem

Mihail Popescu administers two Moldovan SRLs that are **not** IT Park residents:

- **GLOBAL FANTASTIC S.R.L.** — IDNO 1022600056950
- **RARE PEOPLE S.R.L.** — IDNO 1024600014967

They used 1C. There is no external accountant. Mihail will talk to Claude, Grok, or Codex the same way Cristian talks to the Prodius accounting MCP. This project replaces 1C with Postgres + an MCP server.

This system is a **sibling** of Prodius accounting. It must never share a database, Docker volume, port, repo, or migration with `/Users/cristian/ProdiusEnterprise`.

## Users

- **Mihail Popescu** (IDNP 2002002121680) — only operator. Not technical. Opens Grok / Claude / Codex. Does not use a terminal.
- **Cristian** — installs Docker once, connects the MCP server, does not operate the books.

Language for Mihail: **Romanian**. Agent/developer docs: English.

## Isolation

| Thing | Fantastic Account | Prodius (do not touch) |
|---|---|---|
| Folder | `/Users/cristian/Fantastic Account/` | `/Users/cristian/ProdiusEnterprise/` |
| Postgres port | 54339 | 54329 |
| Database | `fantastic_accounting` | `prodius_accounting` |
| Volume | `fantastic_accounting_pgdata` | `prodius_accounting_pgdata` |
| MCP name | `fantastic-accounting` | `prodius-accounting` |

Forbidden: reading, writing, migrating, or composing against any Prodius container or path from this project's scripts.

## Source data we have

Copied into `companies/<slug>/`:

1. SFS declaration packs (XML + PDF), dated 2026-08-10.
2. 1C infobase dumps `1Cv8_*.dt` (proprietary `1CIBDmpF3`). Archived only. Not parsed.

There is no 1C on the build machine. Mihail **does** have 1C. Onboarding includes an optional Excel-export step.

There are no bank statements in the initial pack. Bank import starts when Mihail drops files into `02_Extrase_Bancare/`.

## Facts already extracted from declarations (prefill)

### Shared

- Administrator: Popescu Mihail
- Address: Miron Costin nr.12 of.7, sec. Rîșcani, CUATM 0150, IFS 06
- Legal form: SRL (CFOJ 530), private property (CFP 15)
- Tax regime in filed returns: **SIMM24 4% + TVA12 monthly**. Not IT Park.

### Rare People

- IDNO 1024600014967, CUIIO 41714792
- CAEM 8230 (evenimente / expoziții / congrese)
- No employees (`employeesAbs = 1`)
- SIMM 2024: base 171,961.75, tax 6,878.47
- SIMM 2025: base ~582,226.83, tax 23,289.07
- Forms present: TVA12 (2025-02 … 2026-01), SIMM24, RSF1-presc

### Global Fantastic

- IDNO 1022600056950, CUIIO 41594419, CNAS 9230672
- CAEM 7022 (consultanță business / management)
- Employees historically; 2025 IALS = only Popescu Mihail, 60,000 MDL year, 612 MDL income tax
- SIMM 2024: base 1,108,636.77, tax 44,341.04
- SIMM 2025: base 808,887.93, tax 32,355.52
- Forms present: IPC21 through 2026-06, TVA12, IRM19, IALS21, SIMM24/SIMM20, RSF1-presc, TL13, 2-inv-anual, ei-78

## Product shape

One isolated Node/TypeScript app with:

- One Postgres, multi-company (`company_id` on every operational table).
- One MCP server. Mihail says “treci pe Rare People” / “treci pe Fantastic”.
- No web UI in v1. Interface is the chat app + MCP.
- Conversational onboarding, optional, resumable, prefilled from declarations.
- Historical books reconstructed from declaration XMLs (RSF1 snapshots + tax/payroll facts).
- Optional 1C Excel import when Mihail drops exports.
- Bank import + classification once statements exist.
- “Ce am de plătit luna asta?” is the primary monthly question.

## How Mihail uses it

Cristian starts Docker once and adds the MCP server to Grok/Claude/Codex.

First conversation (or whenever Mihail says “onboarding” / “configurează”):

1. Two-sentence teacher (see Teacher script).
2. “Cu ce firmă lucrăm?”
3. Show what we already know. Ask only gaps.
4. Optional: “Salvează din 1C 4 rapoarte Excel și pune-le în folderul firmei.”
5. He can skip. Books still run on the prefilled SIMM+TVA profile.

Everyday phrases he is taught:

- “Ce am de plătit luna asta?”
- “Treci pe Rare People” / “Treci pe Fantastic”
- “Am pus extrasul în folder”
- “Am pus fișierele din 1C”
- “Închide luna”

## Teacher script (Romanian, keep this short)

```
Salut, Mihail. Aici ții contabilitatea pentru Global Fantastic și Rare People.
Spui cu ce firmă lucrezi. Pui extrasul de bancă sau exportul din 1C în folderul firmei.
Apoi întrebi „ce am de plătit luna asta?”. Când totul e clar, spui „închide luna”.
```

## Onboarding questions (per company, all skippable)

Prefill from declarations. Never block the rest of the system.

1. Confirm tax regime (default SIMM24 4% + TVA payer = yes)
2. What the company actually sells (free text)
3. Bank name + IBAN MDL (and FX IBANs if any)
4. Employees this month / Mihail’s current salary (Fantastic)
5. e-Factura yes/no
6. Foreign invoices / FX yes/no
7. Related-party flows between the two companies yes/no
8. 1C export: skip / files dropped
9. Who signs declarations (default Popescu Mihail)

## 1C export step

Do **not** ask for another `.dt`. Ask Mihail to save Excel/CSV from 1C and drop into `companies/<slug>/04_Export_1C/`:

1. Balanța de verificare — 31.12.2024, 31.12.2025, last closed 2026 month
2. Registru-jurnal / note contabile (if the configuration can export it)
3. Plan de conturi
4. Extrase / jurnal bancar
5. Contrapărți
6. Salariați (Fantastic)

Click-by-click Romanian instructions live in `companies/_shared/ghid-export-1c.md`. Incomplete export is OK. Declarations remain the fallback.

`.dt` files stay in `03_Backup_1C/` as a sealed restore source for *his* 1C, not for our parser.

## Historical reconstruction

1. Index every XML/PDF as a `declarations` row (form, period, key figures, paths).
2. From each RSF1-presc, post a balanced **snapshot journal** on the statement date so the trial balance matches the filed statement. Source = `tax`. Status = posted. Periods 2022–2025 locked after import.
3. From SIMM24/SIMM20, post the annual 4% tax expense/liability.
4. From TVA12, store monthly VAT receivable/payable facts.
5. From IPC21/IRM19/IALS21, store employees and payroll facts; post salary + contribution journals where amounts exist.
6. 2026 periods stay open.

We do not invent journal lines that are not in a declaration or a later 1C Excel export.

## Tax engine (not IT Park)

Per company, from the tax profile (default = filed regime):

| Obligation | Who | When |
|---|---|---|
| TVA12 | both (VAT payers) | monthly |
| SIMM24 4% | both | annual (YTD estimate available monthly) |
| IPC21 | Fantastic while it has employees | monthly |
| IRM19 | Fantastic | on hire/leave |
| IALS21 | Fantastic | annual |
| TL13 | Fantastic (present in pack) | as filed historically; confirm in onboarding |
| RSF1-presc | both | annual |

No IU17, no MITP fee, no 70% eligible-revenue test.

## Data model (v1)

- `companies` — slug PK (`rare-people`, `global-fantastic`)
- `tax_profiles` — regime, vat_payer, simm_rate, notes, source (`declaration` \| `onboarding`)
- `onboarding_answers` — question key, value, answered_at
- `agent_session` — one row, `active_company_id`
- `accounts` — shared Moldovan general-plan subset (no IT Park accounts)
- `fiscal_periods` — unique (company_id, year, month)
- `journal_entries` / `journal_lines` — company_id on the entry
- `bank_accounts` / `bank_statement_imports` / `bank_transactions`
- `declarations` / `declaration_files`
- `employees`
- `monthly_obligation_templates` / `monthly_obligation_instances` — company-scoped
- `one_c_export_files`

Tests run only against `fantastic_accounting_test`. `resetTestDb` must refuse any database name that does not end in `_test`.

## MCP surface (v1)

Tools:

- `switch_company` `{ slug }`
- `get_teacher`
- `get_onboarding_status`
- `save_onboarding_answer`
- `complete_onboarding`
- `import_declarations` `{ companySlug }`
- `import_one_c_exports` `{ companySlug }`
- `import_bank_folder` `{ companySlug }`
- `what_do_i_owe` `{ year, month }`
- `list_declarations` `{ companySlug?, formType?, year? }`
- `post_journal_entry` `{ entryId }`
- `set_period_status` `{ year, month, status }`
- `check_close_readiness` `{ year, month }`

Resources:

- `session://active-company`
- `company://{slug}/profile`
- `company://{slug}/declarations`
- `accounts://trial-balance?company=&period=`
- `tax://what-do-i-owe?company=&period=`
- `onboarding://status`

Every mutating tool uses the active company unless an explicit slug is passed. Never write across companies.

## Folder layout

```
/Users/cristian/Fantastic Account/
  AGENTS.md
  CLAUDE.md
  README.md
  docs/superpowers/specs/...
  docs/superpowers/plans/...
  companies/
    _shared/ghid-export-1c.md
    rare-people/...
    global-fantastic/...
  accounting/          # the engine
```

## Out of scope for v1

- Any change under `/Users/cristian/ProdiusEnterprise`
- Web UI
- Parsing `.dt` binaries
- e-Factura API
- SFS filing automation
- Multi-user permissions

## Success

Mihail can open Grok, pick a company, see prefilled SIMM+TVA facts from the imported declarations, ask what he owes for the current month, drop a 1C Excel or a bank statement later, and close a month — without a terminal and without touching Prodius.
