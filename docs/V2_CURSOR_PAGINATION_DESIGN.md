# PagiHelp v2 Cursor Pagination Design

This document records the proposed `v2` cursor-pagination design for a future release. It is a design reference only.

Status:

- not implemented as of `pagi-help@2.4.1`
- does not change the current `paginate()` contract
- does not change the legacy default export

## Goals

- add token/cursor pagination to `require("pagi-help/v2")`
- keep existing offset and page-based pagination unchanged
- preserve the current return shape style and SQL-builder role of the library
- support both MySQL and PostgreSQL
- give AI agents a clear contract to follow once implementation starts

## Non-Goals

- no changes to `require("pagi-help")`
- no breaking changes to `paginate()`, `paginateSafe()`, or `paginateLegacy()`
- no union/multi-table cursor pagination in the first version
- no ORM-managed eager loading or Sequelize `include` support
- no automatic execution of SQL or result fetching

## Compatibility Rules

These points must remain true when cursor pagination is implemented:

- `paginate()` keeps current behavior exactly
- `paginateCursor()` is additive on `v2`
- the legacy default export does not gain cursor pagination
- all current characterization tests must continue to pass
- cursor pagination starts as single-table only

## Proposed Public API

Add these new `v2` methods:

```js
paginateCursor(cursorPaginationObject, options)
resolveCursorPage(rows, cursorPlan)
encodeCursorFromRow(row, cursorPlan)
decodeCursor(cursorToken)
validateCursorPaginationInput(cursorPaginationObject, options)
```

`paginateCursor()` remains a SQL builder. It does not fetch rows.

## Proposed Input Shape

```js
{
  search: "mail",
  filters: [["status", "=", "Active"]],
  sort: {
    attributes: ["createdAt"],
    sorts: ["desc"]
  },
  limit: 20,
  after: "base64url-token"
}
```

Rules:

- `sort` is required
- `limit` is required
- `after` is optional in phase 1
- `before` is not supported in phase 1
- `pageNo`, `itemsPerPage`, and `offset` are rejected in `paginateCursor()`
- `options` must contain exactly one table block in phase 1

## Why `resolveCursorPage()` Exists

This library returns SQL. It does not execute queries.

To know whether there is another page, cursor pagination needs one extra row:

- query asks for `limit + 1` rows
- caller executes the query
- `resolveCursorPage()` trims the extra row and returns page metadata

That keeps the library compatible with its current role as a query builder.

## Proposed `paginateCursor()` Return Shape

```js
{
  countQuery,
  totalCountQuery,
  query,
  replacements,
  cursorPlan
}
```

Notes:

- `countQuery` and `totalCountQuery` keep the current `v2` aggregate semantics
- `query` is the data query with cursor predicate and `limit + 1`
- `cursorPlan` is new and is used by `resolveCursorPage()` and `encodeCursorFromRow()`

Example `cursorPlan`:

```js
{
  version: 1,
  dialect: "postgres",
  direction: "forward",
  requestedLimit: 20,
  fetchLimit: 21,
  normalizedSort: [
    { attribute: "createdAt", direction: "DESC" },
    { attribute: "id", direction: "DESC" }
  ],
  cursorAliases: ["createdAt", "id"],
  queryFingerprint: "sha256-hex"
}
```

## Proposed `resolveCursorPage()` Return Shape

```js
{
  rows,
  pageInfo: {
    hasNextPage,
    hasPreviousPage,
    startCursor,
    endCursor,
    nextCursor
  }
}
```

Phase 1 semantics:

- `hasPreviousPage` is `true` when `after` was provided, otherwise `false`
- `nextCursor` is derived from the last kept row when an extra row exists
- `startCursor` and `endCursor` are derived from the kept rows
- `prevCursor` is out of scope for phase 1

## Sort Requirements

Cursor pagination requires deterministic ordering.

Rules:

- `sort.attributes.length` must equal `sort.sorts.length`
- `sort` cannot be empty
- `id` must be present as the final unique tie-breaker
- if the caller does not include `id`, the library appends it
- appended `id` should use the direction of the last explicit sort field

Examples:

```js
{ attributes: ["createdAt"], sorts: ["desc"] }
```

Normalizes to:

```js
[
  { attribute: "createdAt", direction: "DESC" },
  { attribute: "id", direction: "DESC" }
]
```

Mixed-direction sorts are allowed:

```js
{ attributes: ["status", "createdAt"], sorts: ["asc", "desc"] }
```

Normalizes to:

```js
[
  { attribute: "status", direction: "ASC" },
  { attribute: "createdAt", direction: "DESC" },
  { attribute: "id", direction: "DESC" }
]
```

## Single-Table Restriction

Phase 1 must reject:

- more than one option block
- union padding via `filler()`
- cursor pagination over combined result sets

Reason:

- cursor predicates need one stable ordering domain
- union branches do not currently share a single guaranteed cursor identity

## Cursor Token Format

The token should be opaque to callers but simple internally.

Proposed encoded payload before base64url:

```js
{
  v: 1,
  d: "postgres",
  fp: "sha256-hex",
  s: [
    ["createdAt", "DESC"],
    ["id", "DESC"]
  ],
  values: ["2026-03-14T10:00:00.000Z", 123],
  dir: "after"
}
```

Rules:

- `v` is token format version
- `d` is dialect
- `fp` is a query fingerprint
- `s` captures normalized sort fields
- `values` are the last-seen row values
- `dir` is cursor direction

The token should be base64url-encoded JSON.

## Query Fingerprint

To stop a cursor from being reused against a different query shape, the library should derive a fingerprint from the normalized query inputs.

Fingerprint inputs should include:

- dialect
- tableName
- joinQuery
- search text
- filters
- additionalWhereConditions
- normalized sort
- searchColumnList
- relevant column aliases used for cursor extraction

Recommended implementation:

- deterministic JSON serialization
- `sha256` via Node `crypto`

## Cursor Predicate Generation

Use lexicographic disjunctions instead of dialect-specific row-value comparisons. This keeps behavior consistent across MySQL and PostgreSQL.

Example sort:

```js
[
  { attribute: "createdAt", direction: "DESC" },
  { attribute: "id", direction: "DESC" }
]
```

For `after` values `["2026-03-14T10:00:00.000Z", 123]`:

```sql
(
  created_at < ?
  OR (created_at = ? AND id < ?)
)
```

Mixed-direction example:

```js
[
  { attribute: "status", direction: "ASC" },
  { attribute: "createdAt", direction: "DESC" },
  { attribute: "id", direction: "DESC" }
]
```

Produces:

```sql
(
  status > ?
  OR (status = ? AND created_at < ?)
  OR (status = ? AND created_at = ? AND id < ?)
)
```

Comparison rules:

- `ASC` + `after` -> `>`
- `DESC` + `after` -> `<`

Phase 1 does not support `before`.

## Pagination Clause

Cursor mode fetches one extra row:

- requested `limit = 20`
- generated SQL fetches `21`

Dialect-specific pagination remains:

- MySQL: `LIMIT ?,?` with replacements `[0, fetchLimit]` when there is no offset
- PostgreSQL: `LIMIT ? OFFSET ?` with replacements `[fetchLimit, 0]` when there is no offset

Unlike offset pagination, cursor mode does not use caller-provided offsets.

## Null Handling

Phase 1 should reject nullable cursor values.

Reasons:

- null ordering differs by database and query form
- token comparison semantics become fragile

Validation rules:

- the cursor token cannot contain `null` in sort values
- `encodeCursorFromRow()` throws if a cursor sort field resolves to `null` or `undefined`

If callers need nullable fields, they should sort on a non-null computed alias instead.

## Field Resolution Rules

Cursor sort fields should resolve the same way normal `v2` sorting works:

- by alias
- through `columnNameConverter`

Raw `schema.table.column` values remain supported only in `additionalWhereConditions`, not in cursor sort attributes.

## Sequelize Model Support

Cursor pagination can support Sequelize models later without changing this design fundamentally.

The recommended future integration is:

- allow `model` instead of `tableName`
- resolve dialect from `model.sequelize.getDialect()`
- resolve schema-qualified table name from `model.getTableName()`
- map `attribute` names through `model.rawAttributes[field].field`

This should remain a metadata adapter only. It should not become a full Sequelize query builder.

## Validation Rules

`validateCursorPaginationInput()` should reject:

- missing `sort`
- missing `limit`
- `limit < 1`
- `limit` above a future max if one is introduced
- more than one option block
- empty `columnList`
- missing `id` alias when the library cannot append a stable tie-breaker
- `before` in phase 1
- `pageNo`, `itemsPerPage`, or `offset`
- invalid or mismatched cursor token
- query fingerprint mismatch

## Proposed Implementation Order

Phase 1:

- `paginateCursor()`
- `resolveCursorPage()`
- `encodeCursorFromRow()`
- `decodeCursor()`
- `validateCursorPaginationInput()`
- single-table only
- `after` only
- MySQL and PostgreSQL

Phase 2:

- `before`
- reverse traversal helpers
- `prevCursor`

Phase 3:

- evaluate multi-table cursor pagination only if there is a real consumer need

## Test Plan

When implemented, add:

- MySQL single-table cursor tests
- PostgreSQL single-table cursor tests
- token encode/decode tests
- fingerprint mismatch tests
- mixed-direction sort tests
- null cursor value rejection tests
- schema-qualified PostgreSQL table tests
- Sequelize model metadata adapter tests if that feature is added

Legacy tests must remain unchanged.

## Current Recommendation For Agents

Until this feature is implemented:

- use `paginate()` for page/offset workflows
- do not invent `paginateCursor()` in code changes
- if a user asks for cursor pagination, point to this design doc and treat it as unimplemented future work
