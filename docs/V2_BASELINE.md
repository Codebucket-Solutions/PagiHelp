# PagiHelp v2 Baseline

This file captures the current `v2` contract shipped by `v2.js` at package version `2.2.1`.

The `v2` API is grounded on the old `1.3.0` safe path, but it is now a hardened contract rather than a compatibility layer with legacy toggle switches.

## Export Map

Package `2.2.1` ships two explicit class contracts:

- `require("pagi-help")` -> legacy `PagiHelp` default export from `index.js`
- `require("pagi-help").PagiHelpLegacy` -> same legacy class
- `require("pagi-help").PagiHelpV2` -> current hardened `v2` class
- `require("pagi-help").PagiHelpV210` -> compatibility alias of the current `v2` class
- `require("pagi-help/v2")` -> current hardened `v2` class

Compatibility requirement:

- the default export must remain legacy unless there is an intentional breaking change
- the `v2` subpath must remain the clean entrypoint for new code

## Constructor

`PagiHelpV2` accepts the legacy constructor option plus an optional `validate` flag:

```js
new PagiHelpV2({
  columnNameConverter: (name) => name,
  safeOptions: {
    validate: true,
  },
});
```

Constructor behavior:

- `columnNameConverter` is passed through to the legacy base class
- only `safeOptions.validate` is supported
- legacy compatibility switches are not supported on `v2`

## Method Contract

`v2` intentionally changes these public methods from legacy behavior:

- `validatePaginationObject()`, `validateOptions()`, and `validatePaginationInput()` normalize omitted `search` and `searchColumnList` before validating and suppress legacy-only warnings
- `tupleCreator()`, `processFilterCondition()`, `collectFilterConditions()`, and `buildOrderByQuery()` surface `Error` objects instead of legacy string throws
- `buildSingleTableBaseQueries()` always builds aggregate `countQuery`
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

If a caller tries to pass legacy compatibility keys like `countQueryMode`, `emptyInStrategy`, or `rejectSearchAliases`, `v2` should throw an `Error` that points them to `paginateLegacy()`.

## What Should Not Change Accidentally

These are `v2` contract points and should be treated as compatibility-sensitive:

- `require("pagi-help")` must not start returning `PagiHelpV2`
- `require("pagi-help/v2")` must keep returning the hardened `v2` class
- `PagiHelpV2#paginate()` must remain hardened-by-default
- `PagiHelpV2#paginateLegacy()` must remain the explicit legacy escape hatch
- the return shape must remain `{ countQuery, totalCountQuery, query, replacements }`
- omitted `search` and omitted `searchColumnList` must keep normalizing safely
- `Error` objects must keep replacing legacy string throws on the `v2` path

## Reference Files

- `v2.js` contains the runtime wrapper for current `v2`
- `v2.d.ts` contains the subpath declaration file
- `index.js` still contains the legacy default export
- `index.d.ts` exposes the named `PagiHelpV2`, `PagiHelpV210`, and `PagiHelpLegacy` exports
- `test/characterization.test.js` contains the `v2` and legacy regression coverage
