# PagiHelp

Generalized API helper for MySQL search, filters, sorting, and pagination.

This repository now treats the current `1.1.0` runtime behavior as the stable contract.

## Installation

```bash
npm install pagi-help
```

## Include

```js
const PagiHelp = require("pagi-help");
```

## Stable Contract References

Use these files as the authoritative references for the current behavior:

- `README.md`: public quick start
- `docs/AGENT_USAGE.md`: concise usage guide for AI agents and maintainers
- `docs/MAINTENANCE_BASELINE.md`: detailed runtime contract and known quirks
- `test/characterization.test.js`: regression suite for current SQL generation behavior

## Main API

```js
const pagiHelp = new PagiHelp({
  columnNameConverter: (name) => name,
});

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

Meaning:

- `query`: data query, with optional `ORDER BY` and `LIMIT`
- `countQuery`: row-select query without `ORDER BY` and `LIMIT`
- `totalCountQuery`: actual aggregate count query
- `replacements`: bound values for the generated SQL

Important:

- `countQuery` is not `COUNT(*)`
- use `totalCountQuery` when you need the real total count

## Quick Start

```js
const body = {
  search: "mail",
  filters: [
    ["assigned_to_me", "=", "Yes"],
    ["l.stage", "IN", ["NEW", "PROCESSING"]],
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
      " l left join investor_registration i on l.investor_id = i.investor_id ",
    additionalWhereConditions: [["l.status", "=", "Active"]],
  },
];

const pagiHelp = new PagiHelp({
  columnNameConverter: (name) =>
    name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
});

const queries = pagiHelp.paginate(body, options);

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

## `paginationObject`

Expected shape:

```js
{
  search: "xyz",
  sort: {
    attributes: ["createdDate"],
    sorts: ["asc"]
  },
  filters: [
    ["fromDate", "=", "2022-05-05"],
    [
      ["campaignDescription", "=", "abc"],
      ["toDate", "=", "2022-06-05"]
    ]
  ],
  pageNo: 1,
  itemsPerPage: 20
}
```

Supported pagination modes:

- page mode: `pageNo` + `itemsPerPage`
- offset mode: `offset` + `limit`

Recommended defaults:

- always pass `search` as a string
- use `search: ""` when search is disabled

## Filter Structure

The basic filter unit is:

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

- top-level filter items are joined with `AND`
- nested arrays become `OR` groups
- nesting can recurse

### `AND`

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

### `OR`

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

### `IN`

```js
filters: ["stage", "IN", ["NEW", "PROCESSING"]];
filters: ["stage", "NOT IN", ["ARCHIVED", "DELETED"]];
filters: ["role", "! IN", ["Guest"]];
```

### Other supported operators

- `=`, `!=`, `<>`, `>`, `>=`, `<`, `<=`
- `IN`, `NOT IN`, `! IN`
- `IS`, `IS NOT`
- `LIKE`, `RLIKE`, `MEMBER OF`
- `JSON_CONTAINS`, `JSON_OVERLAPS`, `FIND_IN_SET`

Examples:

```js
filters: ["metaInfo", "JSON_CONTAINS", { tags: ["vip"] }];
filters: ["metaInfo", "JSON_OVERLAPS", { tags: ["vip"] }];
filters: ["tags", "FIND_IN_SET", "vip"];
```

## Filter Field Resolution

Filter fields can target:

- exact aliases such as `"createdDate"`
- snake_case forms of camelCase aliases such as `"created_date"`
- literal `prefix.name` values such as `"l.stage"`
- statement-backed aliases

If no column matches, the library throws:

```js
"Invalid filter field: <field>"
```

## `columnList`

Each `columnList` entry should use one of these shapes:

### Plain column

```js
{ name: "campaign_id", alias: "id" }
```

### Prefixed column

```js
{ name: "created_date", prefix: "l", alias: "createdDate" }
```

### Statement column

```js
{
  statement: '(SELECT IF(l.assigned_to="1","Yes","No"))',
  alias: "assignedToMe",
}
```

Field meaning:

- `name`: database column name
- `prefix`: table alias or qualifier placed before `name`
- `alias`: logical output name after `AS`
- `statement`: raw SQL expression used instead of `name`

Rules:

- `name` and `statement` are alternatives
- `alias` is strongly recommended and is effectively required for filtering, sorting, and union alignment
- include an `id` alias in normal application usage

## `searchColumnList`

Supported search entry shapes:

```js
{ name: "email" }
{ name: "email", prefix: "i" }
{ name: "xg.group_name" }
{ statement: "(SELECT category_name FROM support_category WHERE id = support_raise_complain.category_id)" }
```

Rules:

- always pass `searchColumnList`; use `[]` if there are no search columns
- do not include `alias` in `searchColumnList`
- statement expressions and raw dotted names are supported

## `additionalWhereConditions`

`additionalWhereConditions` uses the same nesting structure as `filters`, but it runs in raw mode.

That means:

- operators are not validated
- parenthesized string values can be inlined directly

Examples:

```js
additionalWhereConditions: [["status", "IN", "(SELECT status FROM live_statuses)"]];
additionalWhereConditions: ["cc.status", "!=", "Deleted"];
```

## Sorting

- allowed sort directions are `ASC` and `DESC`
- input is case-insensitive
- `paginate()` appends `id DESC` automatically as a tie-breaker
- the `sort.attributes` and `sort.sorts` arrays are mutated in place

## Multiple Tables (`UNION ALL`)

Pass multiple option blocks to `paginate()` to build a `UNION ALL`.

Current behavior:

- branches are aligned by alias
- missing aliases are padded with `(NULL)`
- `totalCountQuery` becomes `SELECT SUM(countValue) ...`

## Important Runtime Notes

These are current real behaviors of `1.1.0`:

- `joinQuery` is concatenated directly after ``FROM `tableName``` with no normalization
- if `search` is omitted and `searchColumnList` is non-empty, the library searches for `%undefined%`
- if `searchColumnList` contains `alias`, the generated search SQL is invalid
- if no filters, no additional conditions, and no non-empty search are present, the generated SQL ends with a dangling `WHERE`
- empty arrays with `IN`-style operators produce invalid SQL such as `IN ()`

## Type Information

The package ships TypeScript declarations in `index.d.ts`.

## Exact Behavior

For exact current behavior, quirks, and regression references, see:

- `docs/AGENT_USAGE.md`
- `docs/MAINTENANCE_BASELINE.md`
- `test/characterization.test.js`
