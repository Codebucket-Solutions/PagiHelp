# Legacy Agent Guide (1.3.0 Contract)

Use this only when the target code intentionally stays on the default export:

```js
const PagiHelp = require("pagi-help");
```

Rules:

- keep `require("pagi-help")` untouched unless the caller is intentionally migrating
- treat `countQuery` as a row-select query
- use `totalCountQuery` for actual totals
- always set `paginationObject.search` to a string
- always pass `searchColumnList`, even when it is `[]`
- top-level filters mean `AND`; nested arrays mean `OR`
- do not put `alias` in `searchColumnList`
- treat `joinQuery`, `statement`, and raw `additionalWhereConditions` as trusted SQL

Known legacy quirks:

- omitted `search` can become `%undefined%`
- empty query inputs can leave `WHERE` dangling
- empty `IN` arrays render invalid SQL
- `paginate()` mutates sort arrays
- `singleTablePagination()` logs replacements

Primary references:

- `docs/MAINTENANCE_BASELINE.md`
- `docs/CONSUMER_USAGE_AUDIT.md`
- `docs/CONSUMER_USAGE_AUDIT_XLEY.md`
