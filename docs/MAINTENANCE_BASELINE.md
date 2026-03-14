# PagiHelp Legacy Maintenance Baseline

This file captures the legacy default-export behavior preserved in `index.js` at package version `2.2.1`. It remains the compatibility reference for `require("pagi-help")` and `PagiHelpLegacy`.

## Repository shape

- `index.js` contains the legacy default-export runtime implementation.
- `v2.js` contains the current hardened `v2` class built on the `1.3.0` safe path.
- `index.d.ts` provides machine-readable API shapes for editors and AI agents.
- `v2.d.ts` provides the subpath declaration file for `require("pagi-help/v2")`.
- `AGENTS.md` provides repo-specific usage and change instructions for AI agents.
- `README.md` covers the primary `v2` usage path and the legacy split.
- `docs/AGENT_USAGE.md` provides agent-facing canonical usage examples for the current `v2` class.
- `docs/V2_BASELINE.md` records the maintainer contract for the current `v2` class.
- `docs/legacy/README.md` and `docs/legacy/AGENT_USAGE_1.3.0.md` preserve the legacy guidance.
- `examples/` provides runnable example setups for single-table, joined-table, and union usage.
- `diagram.png` is a high-level concept diagram, not an exact representation of the generated SQL.
- `docs/COMMIT_HISTORY_NOTES.md` traces every meaningful commit and maps it to current regression coverage.
- `docs/CONSUMER_USAGE_AUDIT.md` records real downstream usage patterns from an audited application and the invariants they depend on.
- `docs/CONSUMER_USAGE_AUDIT_XLEY.md` records additional downstream usage patterns from a second audited application.
- `test/characterization.test.js` records the current core behavior that should stay stable unless a change is intentional.

## Exported API

The default export remains the legacy class:

```js
const PagiHelp = require("pagi-help");
```

The package now also ships a separate `v2` class, but that contract is documented in `docs/V2_BASELINE.md`.

Constructor:

```js
new PagiHelp({
  columnNameConverter: (name) => name
});
```

- `columnNameConverter` defaults to identity.
- The converter is applied when rendering selected columns and when building `ORDER BY`.

## Method inventory

These methods are implemented as instance fields on the class and are therefore callable from user code.

- `columnNameConverter(name)` converts a logical column name before it is emitted into SQL.
- `columNames(arr)` renders column descriptors into SQL select/search fragments.
- `tupleCreator(tuple, replacements, asItIs)` converts one `[field, operator, value]` tuple into SQL and appends bound values.
- `genSchema(schemaArray, replacements, asItIs)` recursively converts nested filter arrays into grouped `AND` / `OR` SQL.
- `createValidationResult()`, `addValidationIssue()`, and `mergeValidationResults()` build validation reports.
- `isConditionTuple()`, `validateConditionTuple()`, `validateConditionInput()`, `validateSortInput()`, and `validateColumnDescriptor()` are the lower-level validation helpers.
- `validatePaginationObject(paginationObject)`, `validateOptions(options)`, and `validatePaginationInput(paginationObject, options)` report errors and warnings without changing runtime behavior.
- `normalizeSafePaginateOptions()`, `filterValidationResultForSafeOptions()`, `prepareSafePaginationObject()`, `normalizeSafeJoinQuery()`, and `prepareSafeOptions()` prepare safe-mode inputs.
- `tupleCreatorSafe()`, `genSchemaSafe()`, `buildSafeSearchColumns()`, `buildSafeBaseQueries()`, `buildSafeWhereQuery()`, and `singleTablePaginationSafe()` are the safe-mode query builders.
- `paginateSafe(paginationObject, options, safeOptions)` is the additive opt-in API that keeps the return shape but applies safer defaults.
- `singleTablePagination(tableName, paginationObject, searchColumnList, joinQuery, columnList, additionalWhereConditions)` builds one table-specific `SELECT`, `countQuery`, `totalCountQuery`, and replacement list.
- `filler(data)` aligns `columnList` aliases across multiple option blocks by inserting `(NULL)` placeholders so `UNION ALL` projections match.
- `paginate(paginationObject, options)` is the main public entry point; it unions table queries, applies ordering, and applies offset pagination.

## Supported input shapes

`paginate(paginationObject, options)` expects:

- `paginationObject.search`
  Current code treats `""` as the only empty value. `undefined !== ""`, so an omitted `search` becomes `LIKE '%undefined%'`.
- `paginationObject.filters`
  A single tuple is accepted, or an array of tuples/groups.
- `paginationObject.sort`
  Shape: `{ attributes: string[], sorts: string[] }`.
- `paginationObject.pageNo` and `paginationObject.itemsPerPage`
  Offset is derived as `(pageNo - 1) * itemsPerPage`.
- `paginationObject.offset` and `paginationObject.limit`
  Alternate pagination mode when `pageNo/itemsPerPage` are not present.
- `options`
  An array of table configuration blocks used to build one query per table and combine them with `UNION ALL`.

Each option block can contain:

- `tableName` required.
- `columnList` required in practice.
- `searchColumnList` required in practice because `singleTablePagination()` calls `.map()` on it unconditionally.
- `joinQuery` optional string appended directly after ``FROM `tableName``` with no extra validation.
- `additionalWhereConditions` optional array of tuples/groups, evaluated in raw mode.

Each `columnList` item supports:

- `{ name, alias }`
- `{ name, prefix, alias }`
- `{ statement, alias }`

Notes:

- Aliases are functionally required for filtering, sorting, and multi-table unions.
- `searchColumnList` should generally omit `alias`. If an alias is present, the generated `WHERE` clause becomes invalid SQL such as `name AS alias LIKE ?`.

## Query generation pipeline

`paginate()` currently works in this order:

1. If `paginationObject.sort` exists, it mutates it by appending `id` / `desc`.
2. `filler()` mutates each option's `columnList` so every union branch exposes the same alias list in the same order.
3. `singleTablePagination()` is called once per option block.
4. Each per-table `query` and `countQuery` is concatenated with `UNION ALL`.
5. Each per-table `totalCountQuery` is either used directly or wrapped in `SELECT SUM(countValue)` for multi-table mode.
6. If sort is present, `ORDER BY` is added to the unioned `query`.
7. If pagination is present, `LIMIT ?,?` is appended and the offset/limit values are pushed into the shared replacement list.

Important distinction:

- `query` is the data query with optional `ORDER BY` and `LIMIT`.
- `countQuery` is not a `COUNT(*)` query. It is a row-select query without `ORDER BY` / `LIMIT`. Existing callers can count rows by measuring the result length.
- `totalCountQuery` is the actual aggregate count query.

## Opt-in safe API

`paginateSafe()` is additive and does not change legacy `paginate()`.

Default safe-mode behavior:

- clones caller sort arrays
- clones options before `filler()` mutates `columnList`
- normalizes `joinQuery` leading whitespace
- coerces missing `search` to `""`
- omits dangling `WHERE`
- rejects `searchColumnList.alias`
- rejects empty `IN` arrays unless configured otherwise
- returns aggregate `countQuery` by default
- validates inputs before generating SQL

Compatibility flags allow callers to selectively keep legacy behavior where needed.

## Filter semantics

Top-level semantics:

- Each top-level tuple is joined with `AND`.
- A nested array becomes an `OR` group.
- Nested `OR` groups can recurse arbitrarily because `genSchema()` calls itself.

Examples:

- `["from_date", "=", "2022-05-05"]` becomes `from_date = ?`
- `[["a", "=", 1], ["b", "=", 2]]` becomes `( a = ? OR b = ?)`
- `[["x", "=", 1], [[["a", "=", 1], ["b", "=", 2]]]]` is supported recursively

Filter field resolution inside `singleTablePagination()`:

- First try exact `columnList.alias === field`.
- Then try snake_case to camelCase normalization.
- Then try literal `prefix.name` matching for fields like `l.stage`.
- If no column matches, the library throws the string `Invalid filter field: <field>`.

Supported validated operators:

- `>`
- `>=`
- `<`
- `<=`
- `=`
- `!=`
- `<>`
- `IN`
- `NOT IN`
- `! IN`
- `IS`
- `IS NOT`
- `LIKE`
- `RLIKE`
- `MEMBER OF`
- `JSON_CONTAINS`
- `JSON_OVERLAPS`
- `FIND_IN_SET`

Operator-specific behavior:

- `JSON_CONTAINS` and `JSON_OVERLAPS` emit `OPERATOR(field, ?)` and stringify object/array values before binding.
- `FIND_IN_SET` emits `FIND_IN_SET(?, field)`.
- Array values emit ` (?, ?, ...)` placeholders.
- In raw mode (`additionalWhereConditions`), parenthesized string values are inlined without a placeholder. This is what enables subqueries such as `["status", "IN", "(SELECT status FROM live_statuses)"]`.

## Sorting behavior

- Allowed sort directions are `ASC` and `DESC` only, case-insensitive on input.
- Sort directions are normalized to uppercase in place.
- Every sort request has `id DESC` appended automatically as a tie-breaker.
- Sort attributes are escaped with `sqlstring.escapeId()` and then passed through `columnNameConverter()`.
- If a sort direction is invalid, the library throws the string `INVALID SORT VALUE`.

## Multi-table union behavior

`filler()` exists only for union mode:

- It gathers every alias from every option block.
- It mutates each `columnList` so missing aliases are replaced with `{ statement: "(NULL)", alias }`.
- The README says missing aliases are returned as `""`, but the implementation actually uses SQL `NULL`.

This mutation is important because `UNION ALL` requires the same projection width and compatible ordering across all branches.

## Current behavior that should be treated as contractual unless intentionally changed

- The package exports only the `PagiHelp` class.
- `paginate()` returns `{ countQuery, totalCountQuery, query, replacements }`.
- `countQuery` is a row-select query, not an aggregate count.
- `totalCountQuery` is the authoritative count query.
- Filters can target aliased columns, snake_case equivalents of camelCase aliases, explicit `prefix.name` fields, and statement-backed columns.
- `additionalWhereConditions` bypass operator validation and can inline parenthesized subqueries.
- Multi-table mode pads missing aliases with `(NULL)` and aggregates total count with `SUM(countValue)`.
- Sort validation is strict and throws string values rather than `Error` objects.

## Known limitations and quirks in the current implementation

These behaviors are real today, but they are better treated as bugs or cleanup candidates than as long-term contract:

- `paginate()` mutates the caller's `paginationObject.sort.attributes` and `paginationObject.sort.sorts`.
- `singleTablePagination()` logs the replacements array to stdout once per option block.
- If there are no `additionalWhereConditions`, no filters, and no non-empty search, the generated SQL ends with a dangling `WHERE`.
- If `search` is omitted but `searchColumnList` is present, the code searches for `%undefined%`.
- If `searchColumnList` items include `alias`, the generated search SQL is invalid because `AS alias` appears inside `WHERE`.
- `IN` with an empty array produces `IN ()`, which is invalid SQL.
- `searchColumnList` is effectively required even though the signature looks optional.

Future fixes in these areas should be intentional and accompanied by targeted tests and README updates.

## Safe change checklist

- Preserve the exact return shape of `paginate()` unless making a versioned API change.
- Preserve `countQuery` versus `totalCountQuery` semantics unless existing callers are migrated.
- Preserve alias-based filter resolution, including snake_case to camelCase matching.
- Preserve special handling for `JSON_CONTAINS`, `JSON_OVERLAPS`, `FIND_IN_SET`, and raw subquery conditions.
- Preserve union alias padding with `(NULL)` unless all union consumers are updated together.
- When fixing a known limitation, add a new characterization test that documents the intentional behavior change.
- Re-run `npm test` after every change; the test suite is intended to catch query-string regressions quickly.
- Run `npm run release:verify` before publishing so tests, typings, and package contents are verified together.

## Characterization coverage

The current test suite covers:

- Basic single-table query generation with search, filters, sort, and page-based pagination.
- Direct helper behavior for `columNames()`, `tupleCreator()`, `genSchema()`, and `singleTablePagination()`.
- Validation helpers for pagination objects, options, and combined input checking.
- `paginateSafe()` defaults for sort cloning, option cloning, empty-where omission, join normalization, search coercion, aggregate counts, and configurable empty-`IN` handling.
- CamelCase/snake_case alias resolution and special operators.
- Multi-table `UNION ALL` generation with alias padding and aggregate total counts.
- Raw `additionalWhereConditions` subquery support.
- Current quirks such as `%undefined%` search, dangling `WHERE`, invalid search aliases, and sort-array mutation.
- Validation failures for invalid filter fields, operators, and sort directions.
