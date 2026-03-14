# PagiHelp v2 Baseline

This file captures the current `v2` contract shipped by `v2.js` at package version `2.4.0`.

`v2` is grounded on the old `1.3.0` safe path, but it is now a hardened contract with dialect-aware SQL rendering.

## Export Map

Package `2.4.0` ships two explicit class contracts:

- `require("pagi-help")` -> legacy `PagiHelp` default export from `index.js`
- `require("pagi-help").PagiHelpLegacy` -> same legacy class
- `require("pagi-help").PagiHelpV2` -> current hardened `v2` class
- `require("pagi-help").PagiHelpV210` -> compatibility alias of the current `v2` class
- `require("pagi-help/v2")` -> current hardened `v2` class

Compatibility requirement:

- the default export must remain legacy unless there is an intentional breaking change
- the `v2` subpath must remain the entrypoint for new code

## Constructor

```js
new PagiHelpV2({
  dialect: "mysql",
  columnNameConverter: (name) => name,
  safeOptions: {
    validate: true,
  },
});
```

Constructor behavior:

- `dialect` may be `"mysql"` or `"postgres"`
- omitted `dialect` defaults to `"mysql"`
- `columnNameConverter` is passed through to the legacy base class
- only `safeOptions.validate` is supported
- legacy compatibility switches are rejected on `v2`

## Dialect Contract

Legacy stays MySQL-only. Dialect support applies to `v2` only.

`v2` MySQL:

- keeps the current MySQL renderer
- uses backticks for generated table and `ORDER BY` identifiers
- keeps MySQL-specific operators as MySQL SQL
- paginates with `LIMIT ?,?`

`v2` PostgreSQL:

- switches generated table and `ORDER BY` identifiers to double quotes
- paginates with `LIMIT ? OFFSET ?`
- changes pagination replacement order to `[limit, offset]`
- validates and renders its own native operator set:
  - `ILIKE`
  - `~`, `~*`, `!~`, `!~*`
  - `@>`, `<@`
  - `?`, `?|`, `?&`
  - `&&`
- also accepts compatibility aliases for shared-code migrations:
  - `JSON_CONTAINS` -> `@>`
  - `JSON_OVERLAPS` -> emulated `jsonb` overlap SQL
  - `FIND_IN_SET` -> `array_position(string_to_array(...), ?::text) IS NOT NULL`
  - `RLIKE` -> `~`
  - `MEMBER OF` -> `?::jsonb @> to_jsonb(field)`
  - `! IN` -> `NOT IN`
- uses PostgreSQL-safe `IS NULL`, `IS NOT NULL`, `IS DISTINCT FROM`, and `IS NOT DISTINCT FROM` rendering

Raw `statement`, `joinQuery`, and `additionalWhereConditions` fragments are never translated. They must already match the chosen dialect.

## Method Contract

`v2` intentionally changes these public methods from legacy behavior:

- `validatePaginationObject()`, `validateOptions()`, and `validatePaginationInput()` normalize omitted `search` and `searchColumnList` before validating and suppress legacy-only warnings
- `tupleCreator()`, `processFilterCondition()`, `collectFilterConditions()`, and `buildOrderByQuery()` surface `Error` objects instead of legacy string throws
- `buildSafeBaseQueries()` and `buildSingleTableBaseQueries()` are dialect-aware and always build aggregate `countQuery`
- `buildWhereQuery()` treats missing `search` as `""` and missing `searchColumnList` as `[]`
- `singleTablePagination()` uses the safe single-table path, normalizes `joinQuery`, and never logs replacements
- `paginate()` uses the safe union path with the hardened rules below
- `paginateSafe()` is an alias of `paginate()`
- `paginateLegacy()` is the explicit escape hatch back to legacy query behavior

## Default `v2` Behavior

`paginate()` in `v2` must continue to:

- clone caller sort arrays before appending `id DESC`
- clone options before `filler()` mutates `columnList`
- normalize `joinQuery` to include leading whitespace
- coerce missing `search` to `""`
- treat missing `searchColumnList` as `[]`
- omit empty `WHERE`
- reject `searchColumnList.alias`
- reject empty arrays for `IN`, `NOT IN`, and `! IN`
- validate before SQL generation by default
- return aggregate `countQuery`
- avoid the legacy `console.log(replacements)` side effect
- throw `Error` objects instead of string throws

## Count Semantics

In `v2`:

- `countQuery` is aggregate
- `totalCountQuery` remains aggregate and stays in the return shape for compatibility

This is intentionally different from the legacy default export, where `countQuery` remains a row-select query.

## Supported Overrides

Only one `safeOptions` key is supported on `v2`:

- `validate`

If a caller tries to pass legacy compatibility keys like `countQueryMode`, `emptyInStrategy`, or `rejectSearchAliases`, `v2` must throw an `Error` that points them to `paginateLegacy()`.

## What Should Not Change Accidentally

These are `v2` contract points and should be treated as compatibility-sensitive:

- `require("pagi-help")` must not start returning `PagiHelpV2`
- `require("pagi-help/v2")` must keep returning the hardened `v2` class
- `PagiHelpV2#paginate()` must remain hardened by default
- `PagiHelpV2#paginateLegacy()` must remain the explicit legacy escape hatch
- the return shape must remain `{ countQuery, totalCountQuery, query, replacements }`
- omitted `search` and omitted `searchColumnList` must keep normalizing safely
- MySQL and PostgreSQL pagination clauses must keep their dialect-specific ordering
- PostgreSQL operator translations must stay stable unless intentionally versioned

## Reference Files

- `v2.js` contains the current hardened `v2` class
- `v2/dialects/mysql.js` contains the MySQL SQL renderer for `v2`
- `v2/dialects/postgres.js` contains the PostgreSQL SQL renderer for `v2`
- `v2.d.ts` contains the subpath declaration file
- `index.js` still contains the legacy default export
- `test/mysql.characterization.test.js` covers legacy plus MySQL `v2`
- `test/postgres.characterization.test.js` covers PostgreSQL `v2`
