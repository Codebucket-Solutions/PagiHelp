# Legacy Default Export Archive

This folder preserves the guidance for the legacy default export that is still shipped by `pagi-help@2.4.0`.

Import forms:

```js
const PagiHelp = require("pagi-help");
const { PagiHelpLegacy } = require("pagi-help");
```

Use this path only when code intentionally depends on the legacy SQL contract.

The legacy default export remains MySQL-only. PostgreSQL support exists only on `require("pagi-help/v2")`.

Key legacy behaviors:

- `countQuery` is a row-select query, not an aggregate count
- `totalCountQuery` is the real aggregate count query
- `paginate()` mutates caller sort arrays
- `filler()` mutates option `columnList` arrays for union alignment
- missing `search` can produce `LIKE '%undefined%'`
- empty inputs can produce a dangling `WHERE`
- `joinQuery` is concatenated verbatim
- `singleTablePagination()` logs replacements
- `paginateSafe()` exists as an additive bridge inside the legacy class

Authoritative references:

- `docs/MAINTENANCE_BASELINE.md`
- `docs/legacy/AGENT_USAGE_1.3.0.md`
- `docs/CONSUMER_USAGE_AUDIT.md`
- `docs/CONSUMER_USAGE_AUDIT_XLEY.md`
- `test/mysql.characterization.test.js`
