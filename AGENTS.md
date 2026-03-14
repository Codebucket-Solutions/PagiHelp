# Agent Instructions

Use the package as two explicit contracts.

## Read Order

1. `docs/AGENT_USAGE.md`
2. `docs/V2_BASELINE.md`
3. `docs/MAINTENANCE_BASELINE.md`
4. `docs/legacy/README.md`
5. `test/characterization.test.js`

## Entry Point Rules

- Use `require("pagi-help/v2")` or `require("pagi-help").PagiHelpV2` for new code.
- `PagiHelpV210` is a compatibility alias, not the preferred name for new code.
- Treat `require("pagi-help")` as the frozen legacy default export.
- Never silently rewrite an existing legacy import to the `v2` class.
- Use `paginateLegacy()` only when code is already on a `v2` instance and one call must keep the legacy SQL behavior.

## Main Usage Rules

- `v2` makes `countQuery` an actual aggregate count query.
- In the legacy export, `countQuery` is still a row-select query and `totalCountQuery` is the real aggregate count query.
- In `v2`, missing `search` becomes `""`.
- In `v2`, missing `searchColumnList` becomes `[]`.
- Top-level `filters` items mean `AND`. Nested arrays mean `OR`.
- `IN`, `NOT IN`, and `! IN` should receive array values.
- Do not put `alias` on `searchColumnList` entries in `v2`.
- Treat `joinQuery`, `statement`, and raw `additionalWhereConditions` as trusted-input-only SQL.
- `v2` only supports `safeOptions.validate`. If the caller needs old compatibility toggles, that is a sign they should stay on the legacy path.

## If You Change Behavior

- Keep legacy default-export SQL shape unchanged unless the change is intentionally versioned.
- Update `docs/V2_BASELINE.md` for `v2` contract changes.
- Update `docs/MAINTENANCE_BASELINE.md` for legacy contract changes.
- Add or update characterization tests in `test/characterization.test.js`.
- Run `npm run release:verify`.
