# Agent Usage Guide

This file is the agent-facing quick reference for `pagi-help@2.2.1`.

The package ships two explicit entrypoints:

- `require("pagi-help/v2")` or `require("pagi-help").PagiHelpV2`: current hardened `v2` class
- `require("pagi-help")`: frozen legacy default export

## Choose The Right Entry Point

Use `PagiHelpV2` for:

- new integrations
- AI-generated code
- code that wants aggregate `countQuery`
- code that should avoid dangling `WHERE`, `%undefined%`, sort mutation, raw string throws, and missing `searchColumnList` crashes

Use the legacy default export only for:

- existing applications that already import `pagi-help`
- call sites that depend on the exact legacy SQL shape
- consumer code that still treats `countQuery` as a row-select query

Do not switch an existing legacy import to `v2` unless the caller is intentionally migrating.

## Import Patterns

Preferred:

```js
const PagiHelpV2 = require("pagi-help/v2");
```

Also supported:

```js
const { PagiHelpV2, PagiHelpV210 } = require("pagi-help");
```

Legacy:

```js
const PagiHelp = require("pagi-help");
const { PagiHelpLegacy } = require("pagi-help");
```

## Constructor

Shared constructor option:

```js
const pagiHelp = new PagiHelpV2({
  columnNameConverter: (name) => name,
});
```

`columnNameConverter` is applied when rendering selected columns and `ORDER BY` fields.

`v2` also accepts one optional safe flag:

```js
const pagiHelp = new PagiHelpV2({
  safeOptions: {
    validate: true,
  },
});
```

`validate` is the only supported `safeOptions` key on `v2`.

## Main API

`v2`:

```js
const result = pagiHelp.paginate(paginationObject, options);
```

Legacy:

```js
const result = pagiHelp.paginate(paginationObject, options);
```

Return shape stays the same in both classes:

```js
{
  countQuery,
  totalCountQuery,
  query,
  replacements
}
```

Important semantics:

- `v2` `countQuery` is aggregate
- legacy `countQuery` is row-select
- `totalCountQuery` remains available in both paths
- `query` is the data query with optional `ORDER BY` and `LIMIT`

## Recommended Execution Pattern

For `v2`, use the aggregate count query directly:

```js
const queries = pagiHelp.paginate(paginationObject, options);

const totalCountRows = await sequelize.query(queries.countQuery, {
  replacements: queries.replacements,
  type: QueryTypes.SELECT,
});

const data = await sequelize.query(queries.query, {
  replacements: queries.replacements,
  type: QueryTypes.SELECT,
});
```

For legacy integrations, prefer `totalCountQuery` for actual totals because legacy `countQuery` is not aggregate.

## `v2` Contract

`PagiHelpV2#paginate()` is built on the old safe path, but the behavior is now fixed rather than compatibility-tunable.

`v2`:

- clones caller sort arrays
- clones option arrays before `filler()` inserts `(NULL)` padding
- normalizes `joinQuery` to include leading whitespace
- coerces missing `search` to `""`
- treats missing `searchColumnList` as `[]`
- omits empty `WHERE`
- rejects `searchColumnList.alias`
- rejects empty `IN` arrays
- returns aggregate `countQuery`
- validates before generating SQL by default
- avoids the legacy `console.log(replacements)` side effect
- throws `Error` objects instead of string throws

## `v2` Overrides

Per-call overrides:

```js
const queries = pagiHelp.paginate(paginationObject, options, {
  validate: true,
});
```

That is the only supported override key.

If the caller needs old `countQueryMode`, `emptyInStrategy`, or similar legacy toggles, use the legacy export or call:

```js
const legacyQueries = pagiHelp.paginateLegacy(paginationObject, options);
```

## `columnList` Shapes

`columnList` defines the selected output columns for each branch.

Plain column:

```js
{ name: "campaign_id", alias: "id" }
```

Prefixed column:

```js
{ name: "created_date", prefix: "l", alias: "createdDate" }
```

Statement column:

```js
{
  statement: '(SELECT IF(l.assigned_to="1","Yes","No"))',
  alias: "assignedToMe",
}
```

Rules:

- use exactly one of `name` or `statement`
- `alias` is strongly recommended and effectively required for filters, sorts, and unions
- in practice, include an `id` alias somewhere in `columnList`
- `columnNameConverter` applies to `name`, not to `statement`

## `searchColumnList` Shapes

Supported search descriptors:

```js
{ name: "email" }
{ name: "email", prefix: "i" }
{ name: "xg.group_name" }
{ statement: "(SELECT category_name FROM support_category WHERE id = src.category_id)" }
```

Rules:

- do not use `alias` here in `v2`
- statement-backed search expressions are allowed
- raw dotted names like `xg.group_name` are allowed
- missing `searchColumnList` is treated as `[]`

## Filter Structure

Base tuple:

```js
[field, operator, value]
```

Examples:

```js
["status", "=", "Active"]
["createdDate", ">=", "2024-01-01"]
["stage", "IN", ["NEW", "PROCESSING"]]
```

Boolean semantics:

- top-level items are joined with `AND`
- nested arrays become `OR` groups
- nesting is recursive

Filter fields can target:

- exact aliases like `"createdDate"`
- snake_case forms of camelCase aliases like `"created_date"`
- literal `prefix.name` values like `"l.stage"`
- statement-backed aliases

## Supported Operators

Validated operators:

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

Examples:

```js
["stage", "IN", ["NEW", "PROCESSING"]]
["status", "NOT IN", ["Deleted", "Archived"]]
["role", "! IN", ["Guest"]]
["deletedAt", "IS", null]
["approvedAt", "IS NOT", null]
["metaInfo", "JSON_CONTAINS", { a: 1 }]
["metaInfo", "JSON_OVERLAPS", { tags: ["vip"] }]
["tags", "FIND_IN_SET", "vip"]
```

In `v2`, empty arrays for `IN`-style operators are rejected cleanly.

## Sorting And Pagination

Sort shape:

```js
{
  attributes: ["createdDate"],
  sorts: ["desc"]
}
```

Rules:

- sort directions must resolve to `ASC` or `DESC`
- legacy `paginate()` mutates sort arrays by appending `id DESC`
- `v2` clones sort arrays before applying the same tie-breaker
- `v2` direct helper calls like `buildOrderByQuery()` also avoid mutating caller sort arrays

Pagination modes:

- page mode: `pageNo` + `itemsPerPage`
- offset mode: `offset` + `limit`

## Raw SQL Inputs

Treat these as trusted-input-only:

- `statement`
- `joinQuery`
- raw `additionalWhereConditions`

`joinQuery` is still string-concatenated SQL. `v2` normalizes leading whitespace, but it does not sanitize SQL.

## Legacy References

Use these when the target code intentionally stays on the default export:

- `docs/MAINTENANCE_BASELINE.md`
- `docs/legacy/README.md`
- `docs/legacy/AGENT_USAGE_1.3.0.md`
- `docs/CONSUMER_USAGE_AUDIT.md`
- `docs/CONSUMER_USAGE_AUDIT_XLEY.md`
