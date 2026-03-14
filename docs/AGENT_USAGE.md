# Agent Usage Guide

This file is the agent-facing quick reference for `pagi-help@2.4.0`.

## Entry Points

- `require("pagi-help/v2")` or `require("pagi-help").PagiHelpV2`: current hardened API
- `require("pagi-help")`: frozen legacy default export

Use `v2` for new code. Keep the legacy export only for intentionally compatibility-bound MySQL integrations.

## Constructor

```js
const pagiHelp = new PagiHelpV2({
  dialect: "mysql", // default
  columnNameConverter: (name) => name,
  safeOptions: {
    validate: true,
  },
});
```

Rules:

- `dialect` may be `"mysql"` or `"postgres"`
- omitted `dialect` means `"mysql"`
- `safeOptions.validate` is the only supported `safeOptions` key
- legacy compatibility keys like `countQueryMode` are rejected on `v2`
- the legacy default export does not support PostgreSQL mode

## Dialect Rules

When the target database is PostgreSQL, make the dialect explicit:

```js
const pagiHelp = new PagiHelpV2({
  dialect: "postgres",
});
```

Important differences:

- MySQL pagination: `LIMIT ?,?`, replacements `[offset, limit]`
- PostgreSQL pagination: `LIMIT ? OFFSET ?`, replacements `[limit, offset]`
- MySQL-generated table and `ORDER BY` identifiers use backticks
- PostgreSQL-generated table and `ORDER BY` identifiers use double quotes
- PostgreSQL raw `statement` and `joinQuery` fragments must use PostgreSQL SQL, not MySQL-only functions like `IF()`

Preferred PostgreSQL operators on `v2`:

- `ILIKE`
- `~`
- `~*`
- `!~`
- `!~*`
- `@>`
- `<@`
- `?`
- `?|`
- `?&`
- `&&`

Compatibility aliases still accepted on PostgreSQL `v2`:

- `JSON_CONTAINS` -> `@>`
- `JSON_OVERLAPS` -> emulated `jsonb` overlap SQL
- `FIND_IN_SET` -> `array_position(string_to_array(...), ?::text) IS NOT NULL`
- `RLIKE` -> `~`
- `MEMBER OF` -> `?::jsonb @> to_jsonb(field)`
- `! IN` -> `NOT IN`

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

Important semantics:

- `v2` `countQuery` is aggregate
- legacy `countQuery` is row-select
- `query` is the data query
- `totalCountQuery` remains aggregate in both paths

## `v2` Contract

`v2`:

- clones caller sort arrays
- clones options before `filler()` inserts `(NULL)` union padding
- normalizes `joinQuery`
- coerces missing `search` to `""`
- treats missing `searchColumnList` as `[]`
- omits empty `WHERE`
- rejects `searchColumnList.alias`
- rejects empty `IN` arrays
- validates before generating SQL by default
- avoids the legacy `console.log(replacements)` side effect
- throws `Error` objects instead of legacy string throws

## `columnList`

Supported shapes:

```js
{ name: "campaign_id", alias: "id" }
{ name: "created_date", prefix: "l", alias: "createdDate" }
{ statement: "COUNT(*)", alias: "countValue" }
```

Rules:

- use exactly one of `name` or `statement`
- `alias` is strongly recommended and effectively required for filters, sorts, and unions
- include alias `id` somewhere in each branch
- `statement` is emitted verbatim, so it must match the chosen dialect

## `searchColumnList`

Supported shapes:

```js
{ name: "email" }
{ name: "email", prefix: "i" }
{ name: "xg.group_name" }
{ statement: "(SELECT category_name FROM support_category WHERE id = src.category_id)" }
```

Rules:

- do not use `alias` here in `v2`
- statement-backed search expressions are allowed
- raw dotted field names are allowed
- missing `searchColumnList` becomes `[]`

## Filters And Nesting

Base tuple:

```js
[field, operator, value]
```

Semantics:

- top-level items are joined with `AND`
- nested arrays become `OR` groups
- nesting can recurse

Examples:

```js
["status", "=", "Active"]
```

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

Common operators:

- `=`
- `!=`
- `IN`
- `NOT IN`
- `! IN`
- `IS`
- `IS NOT`
- `LIKE`
- `ILIKE`

PostgreSQL-native examples:

```js
["metaInfo", "@>", { a: 1 }]
["metaInfo", "<@", { a: 1, b: 2 }]
["metaInfo", "?", "role"]
["metaInfo", "?|", ["role", "status"]]
["metaInfo", "?&", ["role", "status"]]
["tags", "&&", ["vip", "beta"]]
["name", "ILIKE", "%ann%"]
["email", "~*", "^[a-z]"]
```

PostgreSQL compatibility examples:

```js
["metaInfo", "JSON_CONTAINS", { a: 1 }]
["metaInfo", "JSON_OVERLAPS", { tags: ["vip"] }]
["groupId", "MEMBER OF", [1, 2, 3]]
```
Shared `IN` examples:

```js
["stage", "IN", ["NEW", "PROCESSING"]]
["role", "NOT IN", ["Guest", "Banned"]]
["role", "! IN", ["Guest"]]
```

## Raw Conditions

`additionalWhereConditions` runs in raw mode.

Use it for:

- raw field expressions
- custom operators
- parenthesized subqueries

Examples:

```js
["cc.status", "!=", "Deleted"]
["user_id", "IN", "(SELECT user_id FROM active_users)"]
["DATE(created_at)", ">=", "2024-01-01"]
```

Raw fragments are trusted-input-only SQL and must match the selected dialect.

## Execution Pattern

```js
const queries = pagiHelp.paginate(paginationObject, options);

const totalRows = await sequelize.query(queries.countQuery, {
  replacements: queries.replacements,
  type: QueryTypes.SELECT,
});

const dataRows = await sequelize.query(queries.query, {
  replacements: queries.replacements,
  type: QueryTypes.SELECT,
});
```

For legacy integrations, actual totals come from `totalCountQuery`, not `countQuery`.

## Tests And References

- `test/mysql.characterization.test.js`: legacy plus MySQL `v2`
- `test/postgres.characterization.test.js`: PostgreSQL `v2`
- `docs/V2_BASELINE.md`: maintainer contract for `v2`
- `docs/MAINTENANCE_BASELINE.md`: maintainer contract for legacy
