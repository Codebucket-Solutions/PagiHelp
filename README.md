# PagiHelp

`pagi-help@2.3.0` ships two APIs from one package.

- `require("pagi-help")` keeps the frozen legacy MySQL contract.
- `require("pagi-help/v2")` is the current hardened API for new code.

## Install

```bash
npm install pagi-help
```

## Choose Your API

New code:

```js
const PagiHelpV2 = require("pagi-help/v2");
```

Legacy compatibility:

```js
const PagiHelp = require("pagi-help");
```

Named exports are also available:

```js
const {
  PagiHelpLegacy,
  PagiHelpV2,
  PagiHelpV210,
} = require("pagi-help");
```

`PagiHelpV210` remains a compatibility alias. New code should use `PagiHelpV2`.

## `v2` Constructor

```js
const pagiHelp = new PagiHelpV2({
  dialect: "mysql", // default
  columnNameConverter: (name) =>
    name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
  safeOptions: {
    validate: true,
  },
});
```

`v2` constructor rules:

- `dialect` may be `"mysql"` or `"postgres"`
- omitted `dialect` defaults to `"mysql"`
- `safeOptions.validate` is the only supported `safeOptions` key
- legacy compatibility toggles are intentionally rejected on `v2`

The legacy default export does not gain dialect support. It remains the old MySQL implementation.

## Quick Start: MySQL

```js
const PagiHelpV2 = require("pagi-help/v2");

const pagiHelp = new PagiHelpV2({
  dialect: "mysql",
});

const queries = pagiHelp.paginate(
  {
    search: "Active",
    filters: [["status", "IN", ["Active", "Paused"]]],
    sort: {
      attributes: ["created_at"],
      sorts: ["desc"],
    },
    pageNo: 1,
    itemsPerPage: 10,
  },
  [
    {
      tableName: "events",
      columnList: [
        { name: "id", alias: "id" },
        { name: "status", alias: "status" },
        { name: "created_at", alias: "created_at" },
      ],
      searchColumnList: [{ name: "status" }],
    },
  ]
);
```

MySQL pagination clause:

```sql
LIMIT ?,?
```

Replacements are `[offset, limit]`.

## Quick Start: PostgreSQL

```js
const PagiHelpV2 = require("pagi-help/v2");

const pagiHelp = new PagiHelpV2({
  dialect: "postgres",
});

const queries = pagiHelp.paginate(
  {
    search: "mail",
    sort: {
      attributes: ["createdAt"],
      sorts: ["desc"],
    },
    pageNo: 2,
    itemsPerPage: 10,
  },
  [
    {
      tableName: "licenses",
      columnList: [
        { name: "license_id", prefix: "l", alias: "id" },
        { name: "created_at", prefix: "l", alias: "createdAt" },
        {
          statement:
            "(CASE WHEN l.assigned_to = '1' THEN 'Yes' ELSE 'No' END)",
          alias: "assignedToMe",
        },
      ],
      searchColumnList: [{ name: "created_at", prefix: "l" }],
      joinQuery: "l",
    },
  ]
);
```

PostgreSQL pagination clause:

```sql
LIMIT ? OFFSET ?
```

Replacements are `[limit, offset]`.

Use PostgreSQL SQL inside `statement`, `joinQuery`, and raw `additionalWhereConditions`. Do not reuse MySQL-only functions like `IF()` there.

## Return Shape

Both APIs return:

```js
{
  countQuery,
  totalCountQuery,
  query,
  replacements
}
```

Key semantic difference:

- `v2` `countQuery` is aggregate
- legacy `countQuery` is still a row-select query
- `totalCountQuery` remains aggregate in both paths

## What `v2` Fixes

Compared with the legacy export, `v2`:

- stops emitting dangling `WHERE`
- stops turning missing `search` into `%undefined%`
- stops mutating caller sort arrays
- stops logging replacements by default
- makes `countQuery` aggregate
- rejects `alias` in `searchColumnList`
- normalizes `joinQuery`
- treats missing `searchColumnList` as `[]`
- rejects empty `IN` arrays cleanly
- throws `Error` objects instead of string throws

## Dialect Notes

Shared behavior:

- top-level `filters` are joined with `AND`
- nested filter arrays become `OR` groups
- tuples use `[field, operator, value]`
- `joinQuery`, `statement`, and raw `additionalWhereConditions` are trusted-input-only SQL

Dialect-specific rendering on `v2`:

- MySQL quotes generated table and `ORDER BY` identifiers with backticks
- PostgreSQL quotes generated table and `ORDER BY` identifiers with double quotes
- MySQL keeps `JSON_CONTAINS`, `JSON_OVERLAPS`, `FIND_IN_SET`, `RLIKE`, and `MEMBER OF` as MySQL SQL
- PostgreSQL translates:
  - `JSON_CONTAINS` -> `field::jsonb @> ?::jsonb`
  - `JSON_OVERLAPS` -> emulated `jsonb` overlap SQL
  - `FIND_IN_SET` -> `array_position(string_to_array(...), ?::text) IS NOT NULL`
  - `RLIKE` -> `~`
  - `MEMBER OF` -> `?::jsonb @> to_jsonb(field)`
  - `! IN` -> `NOT IN`

## Docs Map

- `AGENTS.md`: repo-level instructions for Codex and other agents
- `docs/AGENT_USAGE.md`: agent-facing quick reference for current `v2`
- `docs/V2_BASELINE.md`: maintainer contract for current `v2`
- `docs/MAINTENANCE_BASELINE.md`: frozen legacy default-export contract
- `docs/legacy/README.md`: legacy archive entrypoint
- `docs/CONSUMER_USAGE_AUDIT.md`: downstream legacy usage audit
- `docs/CONSUMER_USAGE_AUDIT_XLEY.md`: second downstream legacy usage audit
- `test/characterization.test.js`: suite runner
- `test/mysql.characterization.test.js`: legacy plus MySQL `v2` regression coverage
- `test/postgres.characterization.test.js`: PostgreSQL `v2` regression coverage
- `examples/v2.js`: MySQL `v2` example
- `examples/v2-postgres.js`: PostgreSQL `v2` example

## Release Verification

Before publishing, run:

```bash
npm run release:verify
```
