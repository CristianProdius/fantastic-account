# Implementation loop state

Last updated: 2026-08-17 (first implementation pass)
Status: foundation shipped, remaining = polish + live 1C/bank drops

## Shipped

- Isolated sibling at `/Users/cristian/Fantastic Account/` (Postgres **54339**, never Prodius).
- Spec + plan written.
- 14 tests passing.
- Live import: GF 82 declarations / 20 journals / 4 employees; RP 18 declarations / 17 journals.
- MCP tools, onboarding, teacher, 1C drop-folder, bank drop-folder, month-close.

## Next (do these, one cluster per wake)

1. Add MCP server to Grok/Claude config if Cristian wants Mihail to open it tomorrow (`mcp.json` is ready).
2. When Mihail drops 1C Excel/CSV into `04_Export_1C/`, run `import_one_c_exports`.
3. When bank IBANs are known, insert `bank_accounts` and import `02_Extrase_Bancare/`.
4. Add a month-close integration test and a `what_do_i_owe` test for Fantastic June 2026 IPC21.
5. Improve RSF1 line mapping if a 1C trial balance arrives (replace the snapshot plug).
6. Do not touch `/Users/cristian/ProdiusEnterprise`.

## Verify

```bash
cd "/Users/cristian/Fantastic Account/accounting" && pnpm test
```
