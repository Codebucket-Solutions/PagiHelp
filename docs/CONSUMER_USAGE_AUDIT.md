# Consumer Usage Audit

This file records the downstream usage patterns observed in `/Users/abhinavgautam/Downloads/bipard-erp-backend-stage.zip` so future library changes can be checked against real consumer behavior, not only against README examples.

## Version reconciliation

- At audit time, local `index.js` matched the published npm package `pagi-help@1.0.43`.
- The package version in this repo has since been bumped to `2.4.1`, while the default export still preserves the runtime contract documented here.
- npm also has `2.0.0`, but the published `2.0.0` code currently diverges from the `1.0.43` contract in ways that would regress observed consumer behavior.

## Audit scope

The audited consumer application contains:

- `18` `new PagiHelp(...)` constructions
- `18` `.paginate(...)` call sites
- `25` `searchColumnList` blocks
- `25` `additionalWhereConditions` blocks
- `26` `statement:` column/search definitions
- `22` `joinQuery` usages
- `13` direct `totalCountQuery` usages
- `11` direct `countQuery` usages
- `14` export paths that do `paginationQueries.replacements.splice(-2, 2, ...)`
- `3` code paths that rewrite the generated SQL around `ORDER BY` to inject `GROUP BY`

## Real consumer invariants

### `countQuery` remains part of the contract

Observed usage:

- Older call sites still execute `countQuery` directly and use `result.length` as total count.
- Some call sites wrap `countQuery` as a subquery to compute aggregates such as `SUM(no_of_trainees)`.

Implication:

- `countQuery` must remain a standalone row-select query with no `ORDER BY` or `LIMIT`.
- It cannot be converted to `COUNT(*)` without breaking existing consumers.

### `totalCountQuery` is also relied upon

Observed usage:

- Newer call sites execute `totalCountQuery` and read `totalCount[0]?.countValue`.
- Grouped reporting flows sometimes rewrite `totalCountQuery` to count grouped rows or distinct keys.

Implication:

- `totalCountQuery` must remain the aggregate-count query.
- It must stay plain SQL text that callers can post-process when they need grouped semantics.

### Pagination replacements must end with `[offset, limit]`

Observed usage:

- Export flows repeatedly do `paginationQueries.replacements.splice(-2, 2, 0, totalCount)` before rerunning `paginationQueries.query`.

Implication:

- Offset and limit placeholders must remain the final two replacement values.
- Any future feature that adds placeholders after `LIMIT ?,?` would break those export workflows.

### Empty `searchColumnList` is normal

Observed usage:

- Many list endpoints intentionally pass `searchColumnList: []`.

Implication:

- Empty arrays must continue to suppress the `LIKE` block cleanly.
- Search columns should not be treated as mandatory in practice, even if the implementation still requires the property to exist.

### Search expressions without aliases are heavily used

Observed usage:

- Consumers frequently use `searchColumnList` entries such as `{ statement: "(SELECT ...)" }` with no alias.
- These are used for text search over derived fields, concatenations, JSON aggregations, and CASE expressions.

Implication:

- `columNames()` must continue to emit raw `statement` values unchanged when no alias is present.
- Search rendering must continue to accept those expressions in `... LIKE ?` clauses.

### Statement-backed selected columns are common

Observed usage:

- Selected columns routinely use `statement` with aliases for derived values, JSON arrays, CASE expressions, aggregate subqueries, and correlated subqueries.
- Filters are also applied against statement-backed aliases.

Implication:

- Alias-to-statement filter resolution is a real dependency, not a niche behavior.

### Raw `additionalWhereConditions` are used as expressions, not only plain columns

Observed usage:

- Consumers pass raw prefixed columns such as `ed.tenant_id`.
- Consumers also pass raw expression fields such as `(SELECT category_name FROM support_category WHERE id = support_raise_complain.category_id)`.

Implication:

- Raw mode must keep accepting expression fields and parameterized values.
- Operator validation bypass in raw mode remains required.

### `JSON_CONTAINS` must accept already-stringified JSON

Observed usage:

- Consumers push filters such as `["trainingNameId", "JSON_CONTAINS", JSON.stringify(userTrainingNameId)]`.
- They are not always passing objects/arrays directly.

Implication:

- `JSON_CONTAINS` must not double-stringify string values.
- Both object input and pre-stringified JSON input are required behaviors.

### Query strings are post-processed downstream

Observed usage:

- Some reporting paths replace the first `ORDER BY` token with `GROUP BY ... ORDER BY`.
- Some reporting paths rebuild `totalCountQuery` from the generated `query`.

Implication:

- Generated SQL remains an editable template in downstream code.
- This is not a clean API, but it is a real dependency and should be preserved or replaced only with an explicit alternative.

## Coverage added from the consumer audit

The characterization suite now explicitly covers:

- search expressions in `searchColumnList` with no alias
- pre-stringified `JSON_CONTAINS` filters
- raw expression fields in `additionalWhereConditions`
- trailing pagination replacements used by export workflows

## Follow-up guidance

- If a future refactor changes SQL formatting, re-check the consumer paths that use `ORDER_BY_REGEX` and `replacements.splice(-2, 2, ...)`.
- If a future release targets `2.x`, compare against this audit first because npm `2.0.0` currently drops behavior used by the audited `1.x` consumer.
