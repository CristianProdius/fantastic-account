# Implementation loop state

Last updated: 2026-08-17 (1C CSV trial-balance import)
Status: foundation complete; 1C CSV balanță ready; waiting on live drops + MCP wire-up

## Shipped

- Isolated sibling at `/Users/cristian/Fantastic Account/` (Postgres **54339**, never Prodius).
- Spec + plan written. 27 tests passing (`pnpm test` in `accounting/`).
- Live import: GF 82 declarations / 20 journals / 4 employees; RP 18 declarations / 17 journals.
- MCP tools, onboarding (IBAN → `bank_accounts`), teacher, 1C/bank drop-folders, month-close.
- Fantastic June 2026 dues + month-close tests. MCP install notes.
- 1C CSV balanță: headered sold-final columns, `;` vs `,` delimiter, `242.1`→`2421`, date from filename, replace on re-import, unknown accounts skipped, 999 plug. Live `04_Export_1C/` still empty.

## Next (do these, one cluster per wake)

1. Cristian: merge `mcp.json` into Claude/Grok/Codex if Mihail should open it (do not replace other servers).
2. When Mihail drops real 1C Excel/CSV into `04_Export_1C/`, run `import_one_c_exports`.
3. When real IBANs/statements exist, save onboarding IBAN and import `02_Extrase_Bancare/`.
4. Do not touch `/Users/cristian/ProdiusEnterprise`.

## This wake

- Cluster: better 1C CSV trial-balance import (no live samples; fixtures only).
- Parser + import tests in tmp dirs. Did not write into company `04_Export_1C/`.
- Verify: 27/27 passing against `fantastic_accounting_test` on 54339.

## Verify

```bash
cd "/Users/cristian/Fantastic Account/accounting" && pnpm test
```
