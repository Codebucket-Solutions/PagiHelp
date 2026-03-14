# Agent Instructions

Use the package as two explicit contracts.

## Read Order

1. `docs/AGENT_USAGE.md`
2. `docs/V2_BASELINE.md`
3. `docs/MAINTENANCE_BASELINE.md`
4. `docs/legacy/README.md`
5. `test/mysql.characterization.test.js`
6. `test/postgres.characterization.test.js`

## Entry Point Rules

- Use `require("pagi-help/v2")` or `require("pagi-help").PagiHelpV2` for new code.
- `PagiHelpV210` is a compatibility alias, not the preferred name for new code.
- Treat `require("pagi-help")` as the frozen legacy default export.
- Treat the legacy default export as MySQL-only.
- Never silently rewrite an existing legacy import to the `v2` class.
- Use `paginateLegacy()` only when code is already on a `v2` instance and one call must keep the legacy SQL behavior.

## Main Usage Rules

- `v2` makes `countQuery` an actual aggregate count query.
- In the legacy export, `countQuery` is still a row-select query and `totalCountQuery` is the real aggregate count query.
- `v2` accepts `new PagiHelpV2({ dialect: "mysql" | "postgres" })`. Omitted `dialect` means MySQL.
- If the target database is PostgreSQL, make the dialect explicit instead of relying on the MySQL default.
- On PostgreSQL, prefer the native operator set (`ILIKE`, `~`, `~*`, `!~`, `!~*`, `@>`, `<@`, `?`, `?|`, `?&`, `&&`) instead of MySQL-shaped aliases.
- On PostgreSQL, `tableName` may be schema-qualified like `audit.users`; this renders as `"audit"."users"`.
- In `v2`, missing `search` becomes `""`.
- In `v2`, missing `searchColumnList` becomes `[]`.
- Top-level `filters` items mean `AND`. Nested arrays mean `OR`.
- `IN`, `NOT IN`, and `! IN` should receive array values.
- Do not put `alias` on `searchColumnList` entries in `v2`.
- Treat `joinQuery`, `statement`, and raw `additionalWhereConditions` as trusted-input-only SQL.
- For PostgreSQL, raw `statement` and `joinQuery` fragments must use PostgreSQL SQL, not MySQL functions like `IF()`.
- MySQL pagination is `LIMIT ?,?`; PostgreSQL pagination is `LIMIT ? OFFSET ?`, with replacements `[limit, offset]`.
- PostgreSQL compatibility aliases such as `JSON_CONTAINS`, `JSON_OVERLAPS`, `FIND_IN_SET`, `RLIKE`, `MEMBER OF`, and `! IN` still work on `v2`, but they are migration aids, not the preferred dialect contract.
- For PostgreSQL, `schema.table.column` works in raw `additionalWhereConditions`; regular filters still target aliases or `prefix.column`.
- `v2` only supports `safeOptions.validate`. If the caller needs old compatibility toggles, that is a sign they should stay on the legacy path.
- Cursor/token pagination is not implemented yet. If asked about it, read `docs/V2_CURSOR_PAGINATION_DESIGN.md` and treat it as future design, not current behavior.

## If You Change Behavior

- Keep legacy default-export SQL shape unchanged unless the change is intentionally versioned.
- Update `docs/V2_BASELINE.md` for `v2` contract changes.
- Update `docs/MAINTENANCE_BASELINE.md` for legacy contract changes.
- Keep `docs/V2_CURSOR_PAGINATION_DESIGN.md` clearly marked as unimplemented design until the feature lands.
- Add or update characterization tests in the appropriate dialect suite.
- Run `npm run release:verify`.
