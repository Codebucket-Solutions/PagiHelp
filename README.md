# PagiHelp

`pagi-help@2.2.1` ships two APIs from one package.

- `require("pagi-help")` keeps the legacy `1.x` / `1.3.0` contract exactly.
- `require("pagi-help/v2")` is the hardened `v2` API for new code.

## Installation

```bash
npm install pagi-help
```

## Choose Your API

Preferred for new integrations:

```js
const PagiHelpV2 = require("pagi-help/v2");

const pagiHelp = new PagiHelpV2();
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
  PagiHelpV2,
  PagiHelpV210,
} = require("pagi-help");
```

`PagiHelpV210` remains as a compatibility alias. New docs use `PagiHelpV2`.

## Quick Start: `v2`

```js
const PagiHelpV2 = require("pagi-help/v2");

const pagiHelp = new PagiHelpV2({
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

`v2` semantics:

- `query` is the data query with optional `ORDER BY` and `LIMIT`
- `countQuery` is an actual aggregate count query
- `totalCountQuery` remains aggregate for return-shape compatibility
- `replacements` contains the bound values in execution order

Legacy default-export semantics:

- `query` is still the data query
- `countQuery` is still the old row-select query
- `totalCountQuery` is still the real aggregate count query

## What `v2` Fixes

The hardened `v2` path now:

- stops emitting dangling `WHERE`
- stops turning missing `search` into `%undefined%`
- stops mutating caller sort arrays
- stops logging replacements by default
- makes `countQuery` an actual aggregate count
- rejects `alias` in `searchColumnList`
- normalizes `joinQuery`
- treats missing `searchColumnList` as `[]`
- rejects empty `IN` arrays cleanly
- throws `Error` objects instead of string throws

These rules are the contract for `require("pagi-help/v2")`.

## Shared Input Model

The overall query model stays the same across legacy and `v2`.

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

In `v2`:

- `search` is optional and defaults to `""`
- `searchColumnList` is optional and defaults to `[]`

Filter semantics:

- top-level entries are joined with `AND`
- nested arrays become `OR` groups
- tuples use `[field, operator, value]`

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

Do not put `alias` in `searchColumnList` for `v2`.

## `v2` Options

`v2` no longer exposes the old compatibility toggles like `countQueryMode`, `emptyInStrategy`, or `rejectSearchAliases`.

The only supported `safeOptions` key is:

```js
const pagiHelp = new PagiHelpV2({
  safeOptions: {
    validate: true,
  },
});
```

Per-call:

```js
const queries = pagiHelp.paginate(paginationObject, options, {
  validate: true,
});
```

If you need the legacy quirks for a specific call from a `v2` instance, use:

```js
const legacyQueries = pagiHelp.paginateLegacy(paginationObject, options);
```

## Legacy Contract Still Ships

This package does not force old users onto the new behavior.

- Existing `require("pagi-help")` code continues to use the legacy class.
- Existing consumer quirks remain documented in the legacy baseline and audits.
- New code should import `pagi-help/v2` explicitly.

## Docs Map

- `docs/AGENT_USAGE.md`: primary quick reference for current `v2`
- `docs/V2_BASELINE.md`: detailed maintainer contract for current `v2`
- `docs/MAINTENANCE_BASELINE.md`: legacy default-export contract
- `docs/legacy/README.md`: legacy archive entrypoint
- `docs/legacy/AGENT_USAGE_1.3.0.md`: legacy agent quick reference
- `docs/CONSUMER_USAGE_AUDIT.md`: downstream legacy usage audit
- `docs/CONSUMER_USAGE_AUDIT_XLEY.md`: second downstream legacy usage audit
- `test/characterization.test.js`: regression suite for both legacy and `v2`
- `examples/`: runnable examples, including `examples/v2.js`

## Release Verification

Before publishing, run:

```bash
npm run release:verify
```
