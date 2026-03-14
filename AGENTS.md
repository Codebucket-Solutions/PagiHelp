# Agent Instructions

Use the package as two explicit contracts.

## Read Order

1. `docs/AGENT_USAGE.md`
2. `docs/V2_1_0_BASELINE.md`
3. `docs/MAINTENANCE_BASELINE.md`
4. `docs/legacy/README.md`
5. `test/characterization.test.js`

## Entry Point Rules

- Use `require("pagi-help/v2")` or `require("pagi-help").PagiHelpV210` for new code.
- Treat `require("pagi-help")` as the legacy default export.
- Never silently rewrite an existing legacy import to the `v2` class.
- Use `PagiHelpLegacy` only when code intentionally depends on the old SQL contract.

## Main Usage Rules

- Prefer `PagiHelpV210#paginate()` for new integrations.
- Use `paginateLegacy()` only when code is already on a `v2` instance but one call must keep the old behavior.
- Always set `paginationObject.search` to a string. Use `""` when search is disabled.
- Always pass `searchColumnList`. Use `[]` if there is no searchable column.
- Top-level `filters` items mean `AND`. Nested arrays mean `OR`.
- `IN`, `NOT IN`, and `! IN` should receive array values.
- Do not put `alias` on `searchColumnList` entries for new code.
- In `2.1.0`, treat `countQuery` as aggregate by default.
- In the legacy export, treat `countQuery` as a row-select query and `totalCountQuery` as the real aggregate count query.
- Treat `joinQuery`, `statement`, and raw `additionalWhereConditions` as trusted-input-only SQL.

## If You Change Behavior

- Keep legacy default-export SQL shape unchanged unless the change is intentionally versioned.
- Update `docs/V2_1_0_BASELINE.md` for `v2` contract changes.
- Update `docs/MAINTENANCE_BASELINE.md` for legacy contract changes.
- Add or update characterization tests in `test/characterization.test.js`.
- Run `npm run release:verify`.
