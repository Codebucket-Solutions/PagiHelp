# Agent Usage Guide

This file is the agent-facing quick reference for `pagi-help@1.1.1`.

Use this file for normal integration work. Use `docs/MAINTENANCE_BASELINE.md` when you need exact behavior details and quirks.

## Safe Default Rules

- Use `paginate()` for application code.
- Always pass `search` as a string. Use `""` when search is disabled.
- Always pass `searchColumnList`. Use `[]` if there are no search columns.
- Always give returned columns an `alias`. In practice, `id` should exist.
- Do not put `alias` in `searchColumnList`.
- Use `totalCountQuery` for actual counts.
- Use `countQuery` only if you intentionally want the non-aggregate row-select form.

## Constructor

```js
const PagiHelp = require("pagi-help");

const pagiHelp = new PagiHelp({
  columnNameConverter: (name) => name,
});
```

`columnNameConverter` is applied when rendering selected columns and `ORDER BY` fields.

## Main API

```js
const result = pagiHelp.paginate(paginationObject, options);
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

Semantics:

- `query`: data query, plus optional `ORDER BY` and `LIMIT`
- `countQuery`: row-select query without `ORDER BY` and `LIMIT`
- `totalCountQuery`: actual aggregate count query
- `replacements`: bind values for the generated query strings

## Query Execution Pattern

Recommended pattern:

```js
const queries = pagiHelp.paginate(paginationObject, options);

const totalCountRows = await sequelize.query(queries.totalCountQuery, {
  replacements: queries.replacements,
  type: QueryTypes.SELECT,
});

const data = await sequelize.query(queries.query, {
  replacements: queries.replacements,
  type: QueryTypes.SELECT,
});

return {
  data,
  totalCount: totalCountRows[0]?.countValue ?? 0,
};
```

If you intentionally use `countQuery`, remember that it returns rows, not `COUNT(*)`.

## `columnList` Shapes

`columnList` defines what each `SELECT` branch returns. Each entry should use exactly one of these shapes:

### Plain column

```js
{ name: "campaign_id", alias: "id" }
```

Use this when the column comes directly from the base table with no table alias prefix.

### Prefixed column

```js
{ name: "created_date", prefix: "l", alias: "createdDate" }
```

Use this when the column comes from a joined table or when the query uses table aliases. This renders as `l.created_date AS createdDate`.

### Statement column

```js
{
  statement: '(SELECT IF(l.assigned_to="1","Yes","No"))',
  alias: "assignedToMe",
}
```

Use this for raw SQL expressions, computed fields, and subqueries. `statement` is emitted verbatim.

### Field meanings

- `name`: physical database column name
- `prefix`: table alias or table qualifier placed before `name`
- `alias`: logical output field name after `AS`; filters and sorts generally target this
- `statement`: raw SQL expression used instead of `name`

Rules:

- `name` and `statement` are alternatives. Do not send both in one entry.
- `alias` is strongly recommended and is effectively required for filters, sorts, and union alignment.
- In normal application usage, include an `id` alias somewhere in `columnList`.
- `columnNameConverter` applies to `name`, not to `statement`.

## `searchColumnList` Shapes

`searchColumnList` is similar to `columnList`, but it should describe searchable expressions only.

Supported shapes:

```js
{ name: "email" }
{ name: "email", prefix: "i" }
{ name: "xg.group_name" }
{ statement: "(SELECT category_name FROM support_category WHERE id = support_raise_complain.category_id)" }
```

Rules:

- Do not include `alias` in `searchColumnList`.
- `statement` entries are allowed and are emitted directly inside `LIKE` clauses.
- Raw dotted names like `xg.group_name` are also supported.

## Canonical Single-Table Pattern

```js
const paginationObject = {
  search: "abc",
  filters: ["createdDate", ">=", "2024-01-01"],
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
      { name: "email", prefix: "i", alias: "email" },
    ],
    searchColumnList: [
      { name: "stage", prefix: "l" },
      { name: "email", prefix: "i" },
    ],
    joinQuery: " l left join investor_registration i on l.investor_id = i.investor_id ",
    additionalWhereConditions: [["l.status", "=", "Active"]],
  },
];

const queries = pagiHelp.paginate(paginationObject, options);
```

## Filter Resolution Rules

Filter fields can target:

- exact aliases like `"createdDate"`
- snake_case forms of camelCase aliases like `"created_date"`
- literal `prefix.name` values like `"l.stage"`
- statement-backed aliases

Examples:

```js
filters: ["createdDate", ">=", "2024-01-01"];
filters: ["created_date", ">=", "2024-01-01"];
filters: ["l.stage", "IN", ["NEW", "PROCESSING"]];
```

## Filter Structure And Nesting

The basic filter unit is a tuple:

```js
[field, operator, value]
```

Examples:

```js
["status", "=", "Active"]
["createdDate", ">=", "2024-01-01"]
["stage", "IN", ["NEW", "PROCESSING"]]
```

Boolean meaning:

- a single tuple means one condition
- top-level filter items are joined with `AND`
- a nested array inside the top-level list becomes an `OR` group
- nesting can recurse, so an `OR` group can contain more nested `OR` groups

### Single condition

```js
filters: ["status", "=", "Active"];
```

Meaning:

```sql
status = ?
```

### Top-level `AND`

```js
filters: [
  ["status", "=", "Active"],
  ["createdDate", ">=", "2024-01-01"],
];
```

Meaning:

```sql
status = ? AND created_date >= ?
```

### Nested `OR`

```js
filters: [
  ["status", "=", "Active"],
  [
    ["stage", "=", "NEW"],
    ["stage", "=", "PROCESSING"],
  ],
];
```

Meaning:

```sql
status = ? AND (stage = ? OR stage = ?)
```

### Mixed example

```js
filters: [
  ["status", "=", "Active"],
  ["createdDate", ">=", "2024-01-01"],
  [
    ["stage", "=", "NEW"],
    ["stage", "=", "PROCESSING"],
  ],
];
```

Meaning:

```sql
status = ? AND created_date >= ? AND (stage = ? OR stage = ?)
```

### Recursive nesting

```js
filters: [
  ["status", "=", "Active"],
  [
    ["priority", "=", "HIGH"],
    [
      ["stage", "=", "NEW"],
      ["stage", "=", "PROCESSING"],
    ],
  ],
];
```

Meaning:

```sql
status = ? AND (priority = ? OR (stage = ? OR stage = ?))
```

## Supported Operator Patterns

Normal validated operators include:

- `=`, `!=`, `<>`, `>`, `>=`, `<`, `<=`
- `IN`, `NOT IN`, `! IN`
- `IS`, `IS NOT`
- `LIKE`, `RLIKE`, `MEMBER OF`
- `JSON_CONTAINS`, `JSON_OVERLAPS`, `FIND_IN_SET`

Examples:

```js
filters: ["stage", "IN", ["NEW", "PROCESSING"]];
filters: ["stage", "NOT IN", ["ARCHIVED", "DELETED"]];
filters: ["meta_info", "json_contains", { tags: ["vip"] }];
filters: ["meta_info", "json_overlaps", { tags: ["vip"] }];
filters: ["tags", "find_in_set", "vip"];
```

Notes:

- `IN`, `NOT IN`, and `! IN` should receive an array value.
- `JSON_CONTAINS` and `JSON_OVERLAPS` accept objects, arrays, or pre-stringified JSON.
- `FIND_IN_SET` is useful when the database field stores comma-separated values.
- Avoid empty arrays for `IN`-style filters because the current runtime emits invalid SQL such as `IN ()`.

## Sorting

- allowed directions are `ASC` and `DESC`
- input is case-insensitive
- `paginate()` appends `id DESC` automatically as a tie-breaker
- `sort.attributes` and `sort.sorts` are mutated in place by the current runtime

Example:

```js
sort: {
  attributes: ["createdDate"],
  sorts: ["desc"],
}
```

This becomes `ORDER BY created_date DESC, id DESC`.

## Pagination Modes

Page mode:

```js
{
  pageNo: 3,
  itemsPerPage: 25
}
```

This produces `LIMIT ?,?` with offset `(pageNo - 1) * itemsPerPage`.

Offset mode:

```js
{
  offset: 50,
  limit: 25
}
```

If neither mode is provided, no `LIMIT` is added.

## Raw Additional Conditions

`additionalWhereConditions` are rendered in raw mode. That means:

- operators are not validated
- parenthesized string values can be inlined directly
- the same nesting rules apply: top-level items are `AND`, nested arrays are `OR`

Examples:

```js
additionalWhereConditions: [["status", "IN", "(SELECT status FROM live_statuses)"]];
additionalWhereConditions: ["cc.status", "!=", "Deleted"];
```

## Search Column Patterns

Supported search entries include:

- standard columns: `{ name: "email", prefix: "i" }`
- raw dotted names: `{ name: "xg.group_name" }`
- statement expressions: `{ statement: "(SELECT category_name FROM support_category WHERE id = support_raise_complain.category_id)" }`

Avoid this:

```js
searchColumnList: [{ name: "email", prefix: "i", alias: "email" }];
```

That produces invalid SQL because aliases are emitted inside the `WHERE` clause.

## Multi-Table Union

Pass multiple option blocks to `paginate()` to build a `UNION ALL`.

Important behavior:

- every branch is aligned by alias
- missing aliases are padded with `(NULL)`
- `totalCountQuery` becomes `SELECT SUM(countValue) ...`

## Common Mistakes And Gotchas

- Omitting `search` when `searchColumnList` is non-empty produces `LIKE '%undefined%'`.
- `searchColumnList` is effectively required. Use `[]` when there are no search columns.
- Putting `alias` into `searchColumnList` produces invalid SQL because `AS alias` is emitted inside `WHERE`.
- `joinQuery` is appended verbatim after ``FROM `tableName``` and is not normalized.
- If there are no filters, no additional conditions, and no non-empty search, the current runtime emits a dangling `WHERE`.
- Empty arrays for `IN`-style filters produce invalid SQL such as `IN ()`.

## Helper Methods

These methods exist and can be called directly when an agent is extending wrappers or building diagnostics:

- `columNames()`
- `tupleCreator()`
- `genSchema()`
- `singleTablePagination()`
- `filler()`
- `paginate()`

Use `paginate()` unless there is a specific need to work below that level.
