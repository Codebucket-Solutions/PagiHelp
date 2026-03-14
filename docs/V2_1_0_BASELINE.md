# PagiHelp 2.1.0 Baseline

This file captures the `2.1.0` contract introduced by `v2.js`, grounded on the existing `1.3.0` safe path rather than on the published npm `2.0.0` package.

## Export Map

Package `2.1.0` now ships two explicit class contracts:

- `require("pagi-help")` -> legacy `PagiHelp` default export from `index.js`
- `require("pagi-help").PagiHelpLegacy` -> same legacy class
- `require("pagi-help").PagiHelpV210` -> new `2.1.0` class
- `require("pagi-help").PagiHelpV2` -> alias of `PagiHelpV210`
- `require("pagi-help/v2")` -> new `2.1.0` class

Compatibility requirement:

- the default export must remain legacy unless there is an intentional breaking change
- the `v2` subpath must remain the clean entrypoint for new code

## Constructor

`PagiHelpV210` accepts the legacy constructor option plus `safeOptions` defaults:

```js
new PagiHelpV210({
  columnNameConverter: (name) => name,
  safeOptions: {
    countQueryMode: "aggregate",
  },
});
```

Constructor behavior:

- `columnNameConverter` is passed through to the legacy base class
- `safeOptions` are normalized once and stored as class defaults
- per-call overrides are merged on top of the constructor defaults

## Method Contract

`PagiHelpV210` intentionally changes these public methods from legacy behavior:

- `tupleCreator()` routes through the safe tuple builder
- `genSchema()` routes through the safe schema builder
- `buildSingleTableBaseQueries()` uses safe count-query selection
- `buildWhereQuery()` uses the safe where-builder
- `singleTablePagination()` uses the safe single-table path
- `paginate()` uses the safe union path
- `paginateSafe()` is an alias of `paginate()`
- `paginateLegacy()` runs the legacy default-export logic with the current `columnNameConverter`

Shared helper methods such as `columNames()`, `collectFilterConditions()`, `filler()`, `buildOrderByQuery()`, and validation helpers remain inherited from the legacy class unless explicitly overridden above.

## Default `2.1.0` Behavior

`paginate()` in `PagiHelpV210` must continue to:

- clone caller sort arrays before appending `id DESC`
- clone options before `filler()` mutates `columnList`
- normalize `joinQuery` to include leading whitespace
- coerce missing `search` to `""`
- omit empty `WHERE`
- reject `searchColumnList.alias`
- reject empty arrays for `IN`, `NOT IN`, and `! IN`
- validate before SQL generation
- return aggregate `countQuery`
- avoid the legacy `console.log(replacements)` side effect

## Count Semantics

In `PagiHelpV210`:

- `countQuery` is aggregate by default
- `totalCountQuery` remains aggregate and stays in the return shape for compatibility
- `countQueryMode: "select"` is the compatibility switch for legacy row-select count behavior

This is intentionally different from the legacy default export, where `countQuery` remains a row-select query.

## Compatibility Levers

Supported safe options:

- `cloneSort`
- `cloneOptions`
- `normalizeJoinQuery`
- `coerceUndefinedSearchToEmpty`
- `omitEmptyWhere`
- `rejectSearchAliases`
- `emptyInStrategy`
- `countQueryMode`
- `validate`

Behavioral guarantees:

- constructor `safeOptions` become the class default
- per-call overrides win over constructor defaults
- `paginateLegacy()` is the escape hatch when one call must stay on the old contract

## What Should Not Change Accidentally

These are `2.1.0` contract points and should be treated as compatibility-sensitive:

- `require("pagi-help")` must not start returning `PagiHelpV210`
- `require("pagi-help/v2")` must keep returning `PagiHelpV210`
- `PagiHelpV210#paginate()` must remain safe-by-default
- `PagiHelpV210#paginateLegacy()` must keep delegating to true legacy behavior
- the return shape must remain `{ countQuery, totalCountQuery, query, replacements }`
- the shared input model for `paginationObject` and `options` must stay aligned with the legacy class

## Reference Files

- `v2.js` contains the runtime wrapper for `2.1.0`
- `v2.d.ts` contains the subpath declaration file
- `index.js` still contains the legacy default export
- `index.d.ts` exposes the named `PagiHelpV210` and `PagiHelpV2` exports
- `test/characterization.test.js` contains the `2.1.0` regression coverage
