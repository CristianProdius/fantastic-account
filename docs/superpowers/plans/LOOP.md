# Implementation loop state

Last updated: 2026-08-17 (MCP install notes + identity)
Status: foundation complete; waiting on live 1C/bank drops and Cristian wiring MCP

## Shipped

- Isolated sibling at `/Users/cristian/Fantastic Account/` (Postgres **54339**, never Prodius).
- Spec + plan written. 21 tests passing (`pnpm test` in `accounting/`).
- Live import: GF 82 declarations / 20 journals / 4 employees; RP 18 declarations / 17 journals.
- MCP tools, onboarding (IBAN → `bank_accounts`), teacher, 1C/bank drop-folders, month-close.
- Fantastic June 2026 dues + month-close tests.
- README now has copy-paste MCP install for Claude Desktop, Claude Code, Codex, Grok.
- Company identity files list tax facts, drop folders, missing IBAN.

## Next (do these, one cluster per wake)

1. Cristian: merge `mcp.json` into Claude/Grok/Codex if Mihail should open it (do not replace other servers).
2. When Mihail drops 1C Excel/CSV into `04_Export_1C/`, run `import_one_c_exports` and improve trial-balance mapping.
3. When real IBANs/statements exist, save onboarding IBAN and import `02_Extrase_Bancare/`.
4. Do not touch `/Users/cristian/ProdiusEnterprise`.

## This wake

- Cluster: polish docs / MCP install notes (no 1C files in `04_Export_1C/`).
- README install paths + isolation table; COMPANIE.md facts; CLAUDE.md IBAN phrase.
- Test: `mcp.json` DSN is 54339 / `fantastic_accounting`, not Prodius or `*_test`.
- Verify: 21/21 passing against `fantastic_accounting_test` on 54339.

## Verify

```bash
cd "/Users/cristian/Fantastic Account/accounting" && pnpm test
```
