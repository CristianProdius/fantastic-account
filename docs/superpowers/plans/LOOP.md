# Implementation loop state

Last updated: 2026-08-17 (December SIMM YTD reminder)
Status: foundation complete; waiting on live 1C/bank drops + Cristian MCP wire-up

## Shipped

- Isolated sibling at `/Users/cristian/Fantastic Account/` (Postgres **54339**, never Prodius).
- Spec + plan written. 28 tests passing (`pnpm test` in `accounting/`).
- Live import: GF 82 declarations / 20 journals / 4 employees; RP 18 declarations / 17 journals.
- MCP, onboarding IBAN → `bank_accounts`, 1C CSV balanță, month-close, June 2026 dues tests, MCP docs.
- Month-close templates: TVA/IPC monthly; SIMM24 + RSF1 in March; **SIMM24 YTD in December**. June unchanged.

## Next (do these, one cluster per wake)

1. Cristian: merge `mcp.json` into Claude/Grok/Codex if Mihail should open it (do not replace other servers).
2. When Mihail drops real 1C Excel/CSV into `04_Export_1C/`, run `import_one_c_exports`.
3. When real IBANs/statements exist, save onboarding IBAN and import `02_Extrase_Bancare/`.
4. Do not touch `/Users/cristian/ProdiusEnterprise`.

## This wake

- Listed clusters 1–4 already shipped; `04_Export_1C/` and bank folders still empty.
- Filled the Task 10 hole: December SIMM YTD reminder (GF: TVA+IPC+SIMM YTD; RP: TVA+SIMM YTD).
- Verify: 28/28 passing against `fantastic_accounting_test` on 54339.

## Verify

```bash
cd "/Users/cristian/Fantastic Account/accounting" && pnpm test
```
