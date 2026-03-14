# Agent Usage Guide

This file is the agent-facing quick reference for `pagi-help@2.1.0`.

The package now ships two explicit entrypoints:

- `require("pagi-help/v2")` or `require("pagi-help").PagiHelpV210`: new `2.1.0` class
- `require("pagi-help")`: legacy default export, preserved for compatibility

## Choose The Right Entry Point

Use `PagiHelpV210` for:

- new integrations
- AI-generated code
- code that wants aggregate `countQuery`
- code that should avoid sort mutation, option mutation, dangling `WHERE`, and `%undefined%` search behavior

Use the legacy default export only for:

- existing applications that already import `pagi-help`
- call sites that depend on the exact legacy SQL shape
- consumer code that still treats `countQuery` as a row-select query

Do not switch an existing legacy import to `v2` unless the caller is intentionally migrating.

## Import Patterns

Preferred:

```js
const PagiHelpV210 = require("pagi-help/v2");
```

Also supported:

```js
const { PagiHelpV210, PagiHelpV2 } = require("pagi-help");
```

Legacy:

```js
const PagiHelp = require("pagi-help");
const { PagiHelpLegacy } = require("pagi-help");
```

## Constructor

Shared constructor option:

```js
const pagiHelp = new PagiHelpV210({
  columnNameConverter: (name) => name,
});
```

`columnNameConverter` is applied when rendering selected columns and `ORDER BY` fields.

`2.1.0` also accepts default safe overrides:

```js
const pagiHelp = new PagiHelpV210({
  safeOptions: {
    countQueryMode: "select",
    emptyInStrategy: "static",
  },
});
```

## Main API

`2.1.0`:

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

- `2.1.0` default `countQuery` is aggregate
- legacy `countQuery` is row-select
- `totalCountQuery` remains available in both paths
- `query` is the data query with optional `ORDER BY` and `LIMIT`

## Recommended Execution Pattern

For `2.1.0`, either aggregate count query is safe:

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

## `2.1.0` Default Behavior

`PagiHelpV210#paginate()` is built on the `1.3.0` safe path.

Defaults:

- clone caller sort arrays
- clone option arrays before `filler()` inserts `(NULL)` padding
- normalize `joinQuery` to include leading whitespace
- coerce missing `search` to `""`
- omit empty `WHERE`
- reject `searchColumnList.alias`
- reject empty `IN` arrays
- return aggregate `countQuery`
- validate before generating SQL
- avoid the legacy `console.log(replacements)` side effect

## Compatibility Levers In `2.1.0`

Per-call safe overrides:

```js
const queries = pagiHelp.paginate(paginationObject, options, {
  countQueryMode: "select",
  emptyInStrategy: "static",
  rejectSearchAliases: false,
});
```

Supported flags:

```js
{
  cloneSort: true,
  cloneOptions: true,
  normalizeJoinQuery: true,
  coerceUndefinedSearchToEmpty: true,
  omitEmptyWhere: true,
  rejectSearchAliases: true,
  emptyInStrategy: "throw",
  countQueryMode: "aggregate",
  validate: true
}
```

Legacy escape hatch from a `2.1.0` instance:

```js
const legacyQueries = pagiHelp.paginateLegacy(paginationObject, options);
```

This intentionally uses the legacy default-export behavior with the current `columnNameConverter`.

## Legacy Bridge Still Exists

The legacy class still has:

- `validatePaginationObject()`
- `validateOptions()`
- `validatePaginationInput()`
- `paginateSafe()`

That bridge is still useful for incremental migration, but it is not the preferred path for new code. For new work, start with `PagiHelpV210`.

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

- do not use `alias` here for new code
- statement-backed search expressions are allowed
- raw dotted names like `xg.group_name` are allowed
- pass `[]` when there are no searchable columns

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

Examples:

```js
[
  ["status", "=", "Active"],
  ["createdDate", ">=", "2024-01-01"]
]
```

```js
[
  ["status", "=", "Active"],
  [
    ["stage", "=", "NEW"],
    ["stage", "=", "PROCESSING"]
  ]
]
```

That second example means:

```sql
status = ? AND (stage = ? OR stage = ?)
```

## Filter Field Resolution

Filter fields can target:

- exact aliases like `"createdDate"`
- snake_case forms of camelCase aliases like `"created_date"`
- literal `prefix.name` values like `"l.stage"`
- statement-backed aliases

If no column matches, the legacy contract throws `Invalid filter field: <field>`.

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

Notes:

- `IN`-style operators should receive arrays
- `2.1.0` rejects empty arrays by default
- legacy raw `additionalWhereConditions` may inline parenthesized subqueries

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
- `2.1.0` clones sort arrays before applying the same tie-breaker

Pagination modes:

- page mode: `pageNo` + `itemsPerPage`
- offset mode: `offset` + `limit`

## Raw SQL Inputs

Treat these as trusted-input-only:

- `statement`
- `joinQuery`
- raw `additionalWhereConditions`

`joinQuery` is still string-concatenated SQL. `2.1.0` only normalizes leading whitespace by default; it does not sanitize SQL.

## Legacy References

Use these when the target code intentionally stays on the default export:

- `docs/MAINTENANCE_BASELINE.md`
- `docs/legacy/README.md`
- `docs/legacy/AGENT_USAGE_1.3.0.md`
- `docs/CONSUMER_USAGE_AUDIT.md`
- `docs/CONSUMER_USAGE_AUDIT_XLEY.md`
