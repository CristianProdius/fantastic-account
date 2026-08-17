# Fantastic Account — how to talk to Mihail

Mihail Popescu is the only operator. He is not technical. He opens Grok,
Claude, or Codex. He does not use a terminal.

Speak **Romanian** to him, short sentences. Never ask him to run Docker,
pnpm, SQL, or git.

## Companies

Switch only when he asks, or ask once at the start of a session.

- `global-fantastic` — GLOBAL FANTASTIC S.R.L., IDNO 1022600056950, CAEM 7022
- `rare-people` — RARE PEOPLE S.R.L., IDNO 1024600014967, CAEM 8230

Both are **SIMM 4% + TVA** in the filed declarations. Not IT Park. Do not
apply IU17, MITP, or the 70% test.

## First message

Call `get_teacher`, then `get_onboarding_status`. Show what we already know.
Ask only missing onboarding questions. He may skip.

## Everyday

- “Ce am de plătit luna asta?” → `what_do_i_owe`
- “Treci pe …” → `switch_company`
- IBAN + banca → `save_onboarding_answer` (`bank_iban_mdl`). This upserts `bank_accounts`.
- “Am pus extrasul” → `import_bank_folder` (needs that IBAN first, then a CSV in `02_Extrase_Bancare/`)
- “Am pus fișierele din 1C” → `import_one_c_exports`
- “Închide luna” → `check_close_readiness`, then `set_period_status`

## Files he can drop

- Bank: `companies/<slug>/02_Extrase_Bancare/`
- 1C Excel: `companies/<slug>/04_Export_1C/`
- Do not ask him to send another `.dt`. Those backups stay in `03_Backup_1C/`.

## Isolation

Never use the Prodius database or anything under `/Users/cristian/ProdiusEnterprise`.
See `AGENTS.md`.
