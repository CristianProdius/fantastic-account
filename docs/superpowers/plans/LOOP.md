# Implementation loop state

Last updated: 2026-08-17 (onboarding IBAN → bank_accounts)
Status: foundation + June 2026 tests + IBAN onboarding path shipped

## Shipped

- Isolated sibling at `/Users/cristian/Fantastic Account/` (Postgres **54339**, never Prodius).
- Spec + plan written. 20 tests passing (`pnpm test` in `accounting/`).
- Live import: GF 82 declarations / 20 journals / 4 employees; RP 18 declarations / 17 journals.
- MCP tools, onboarding, teacher, 1C drop-folder, bank drop-folder, month-close.
- IPC21 parser falls back to dinamicTable2 totals when table1 is empty.
- Fantastic June 2026: `whatDoIOwe` (TVA −155.57, SIMM 32355.52 from A/2025, IPC21 5000/1200) + month-close (TVA12+IPC21, bank block).
- Onboarding `bank_iban_mdl` parses MD IBANs (spaces OK) and upserts `bank_accounts` (MDL / 2421). Skip does not insert. `import_bank_folder` then waits for CSV, not IBAN.

## Next (do these, one cluster per wake)

1. Add MCP server to Grok/Claude config if Cristian wants Mihail to open it tomorrow (`mcp.json` is ready).
2. When Mihail drops 1C Excel/CSV into `04_Export_1C/`, run `import_one_c_exports`.
3. When real IBANs/statements exist, save onboarding IBAN (now wired) and import `02_Extrase_Bancare/`.
4. Improve RSF1 line mapping if a 1C trial balance arrives (replace the snapshot plug).
5. Do not touch `/Users/cristian/ProdiusEnterprise`.

## This wake

- Cluster: `bank_accounts` insert path when onboarding saves an IBAN.
- Parser: `parseMoldovanIbanAnswer` + upsert on `bank_iban_mdl` (invalid IBAN rejected before save).
- Status now includes `bankAccounts`. Folders still empty — no live IBAN invented.
- Verify: 20/20 passing against `fantastic_accounting_test` on 54339.

## Verify

```bash
cd "/Users/cristian/Fantastic Account/accounting" && pnpm test
```
