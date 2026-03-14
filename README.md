# PagiHelp

`pagi-help@2.1.0` ships two APIs from one package.

- `require("pagi-help")` keeps the legacy `1.3.0` / `1.x` contract exactly.
- `require("pagi-help/v2")` or `require("pagi-help").PagiHelpV210` is the new `2.1.0` class for new code.

## Installation

```bash
npm install pagi-help
```

## Choose Your API

Preferred for new integrations:

```js
const PagiHelpV210 = require("pagi-help/v2");

const pagiHelp = new PagiHelpV210();
```

Legacy compatibility for existing applications:

```js
const PagiHelp = require("pagi-help");

const pagiHelp = new PagiHelp();
```

Named exports are also available:

```js
const {
  PagiHelpLegacy,
  PagiHelpV210,
  PagiHelpV2,
} = require("pagi-help");
```

## Quick Start: `2.1.0`

```js
const PagiHelpV210 = require("pagi-help/v2");

const pagiHelp = new PagiHelpV210({
  columnNameConverter: (name) =>
    name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
});

const paginationObject = {
  search: "mail",
  filters: [
    ["assignedToMe", "=", "Yes"],
    ["stage", "IN", ["NEW", "PROCESSING"]],
  ],
  sort: {
    attributes: ["createdDate"],
    sorts: ["desc"],
  },
  pageNo: 1,
  itemsPerPage: 20,
};

const options = [
  {
    tableName: "licenses",
    columnList: [
      { name: "license_id", prefix: "l", alias: "id" },
      { name: "created_date", prefix: "l", alias: "createdDate" },
      { name: "stage", prefix: "l", alias: "stage" },
      {
        statement: '(SELECT IF(l.assigned_to="1","Yes","No"))',
        alias: "assignedToMe",
      },
      { name: "email", prefix: "i", alias: "email" },
    ],
    searchColumnList: [
      { name: "email", prefix: "i" },
      { name: "stage", prefix: "l" },
    ],
    joinQuery:
      "l LEFT JOIN investor_registration i ON l.investor_id = i.investor_id",
    additionalWhereConditions: [["l.status", "=", "Active"]],
  },
];

const queries = pagiHelp.paginate(paginationObject, options);
```

Return shape:

```js
{
  countQuery,
  totalCountQuery,
  query,
  replacements
}
```

`2.1.0` semantics:

- `query` is the data query with optional `ORDER BY` and `LIMIT`
- `countQuery` is aggregate by default
- `totalCountQuery` is also aggregate and stays available for compatibility
- `replacements` contains the bound values in execution order

Legacy default-export semantics:

- `query` is still the data query
- `countQuery` is still the old row-select query
- `totalCountQuery` is still the real aggregate count query

## What `2.1.0` Changes

`PagiHelpV210` makes the old safe path the default `paginate()` behavior.

Default behavior in the new class:

- does not mutate caller sort arrays
- does not mutate caller option objects before union padding
- normalizes `joinQuery` spacing
- coerces missing `search` to `""`
- omits dangling `WHERE`
- rejects `searchColumnList.alias`
- rejects empty `IN` arrays
- uses aggregate `countQuery`
- validates inputs before generating SQL
- does not log replacements from `singleTablePagination()`

## Shared Input Model

The data model stays the same across legacy and `2.1.0`.

`paginationObject`:

```js
{
  search: "abc",
  filters: [
    ["status", "=", "Active"],
    [
      ["stage", "=", "NEW"],
      ["stage", "=", "PROCESSING"]
    ]
  ],
  sort: {
    attributes: ["createdDate"],
    sorts: ["desc"]
  },
  pageNo: 1,
  itemsPerPage: 20
}
```

Filter semantics:

- top-level entries are joined with `AND`
- nested arrays become `OR` groups
- supported tuples use `[field, operator, value]`

Common `columnList` shapes:

```js
{ name: "campaign_id", alias: "id" }
{ name: "created_date", prefix: "l", alias: "createdDate" }
{ statement: "COUNT(*)", alias: "countValue" }
```

Common `searchColumnList` shapes:

```js
{ name: "email" }
{ name: "email", prefix: "i" }
{ name: "xg.group_name" }
{ statement: "(SELECT category_name FROM support_category WHERE id = src.category_id)" }
```

Do not put `alias` in `searchColumnList` for new code.

## Compatibility Levers

Constructor defaults for the new class:

```js
const pagiHelp = new PagiHelpV210({
  safeOptions: {
    countQueryMode: "select",
    emptyInStrategy: "static",
  },
});
```

Per-call overrides:

```js
const queries = pagiHelp.paginate(paginationObject, options, {
  countQueryMode: "select",
  rejectSearchAliases: false,
});
```

Legacy escape hatch from a `2.1.0` instance:

```js
const legacyQueries = pagiHelp.paginateLegacy(paginationObject, options);
```

Legacy class still exposes `paginateSafe()`, but new integrations should prefer the dedicated `v2` class instead of layering new work onto the legacy export.

## Legacy Contract Still Ships

This package does not force old users onto the new behavior.

- Existing `require("pagi-help")` code continues to use the legacy class.
- Existing consumer quirks remain documented in the legacy baseline and audits.
- New code should import `pagi-help/v2` explicitly.

## Docs Map

- `docs/AGENT_USAGE.md`: primary quick reference for `2.1.0`
- `docs/V2_1_0_BASELINE.md`: detailed maintainer contract for the new class
- `docs/MAINTENANCE_BASELINE.md`: legacy default-export contract
- `docs/legacy/README.md`: legacy archive entrypoint
- `docs/legacy/AGENT_USAGE_1.3.0.md`: legacy agent quick reference
- `docs/CONSUMER_USAGE_AUDIT.md`: downstream legacy usage audit
- `docs/CONSUMER_USAGE_AUDIT_XLEY.md`: second downstream legacy usage audit
- `test/characterization.test.js`: regression suite for both legacy and `2.1.0`
- `examples/`: runnable examples, including `examples/v2.js`

## Release Verification

Before publishing, run:

```bash
npm run release:verify
```
