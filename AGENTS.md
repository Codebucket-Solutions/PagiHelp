# Agent Instructions

Use the current runtime behavior as the source of truth.

## Read Order

1. `docs/AGENT_USAGE.md`
2. `docs/MAINTENANCE_BASELINE.md`
3. `test/characterization.test.js`
4. `README.md` only for historical context

## Use The Library This Way

- Prefer `paginate()` for application code. The other methods are callable, but they are helper-level APIs.
- Always set `paginationObject.search` to a string. Use `""` when search is disabled.
- Always pass `searchColumnList`. Use `[]` if there is no searchable column.
- Top-level `filters` items mean `AND`. Nested arrays mean `OR`.
- `IN`, `NOT IN`, and `! IN` should receive array values.
- Do not put `alias` on `searchColumnList` entries.
- Treat `countQuery` as a row-select query, not as `COUNT(*)`.
- Treat `totalCountQuery` as the real aggregate count query.
- Assume `joinQuery` is concatenated verbatim after ``FROM `tableName``` with no normalization.
- Assume `additionalWhereConditions` run in raw mode and may inline parenthesized subqueries.
- Filters resolve by alias, snake_case/camelCase alias match, literal `prefix.name`, and statement-backed columns.
- Multi-table mode mutates `columnList` through `filler()` and pads missing aliases with `(NULL)`.

## Common Mistakes

- Omitting `search` when `searchColumnList` is present produces `LIKE '%undefined%'`.
- Putting `alias` inside `searchColumnList` produces invalid SQL.
- Passing empty arrays to `IN`-style filters produces invalid SQL.
- If there are no filters, no additional conditions, and no non-empty search, the current runtime emits a dangling `WHERE`.

## If You Change Runtime Behavior

- Preserve SQL string shape unless the behavior change is intentional.
- Update `docs/MAINTENANCE_BASELINE.md` if the contract changes.
- Add or update characterization tests in `test/characterization.test.js`.
- Run `npm run release:verify`.
