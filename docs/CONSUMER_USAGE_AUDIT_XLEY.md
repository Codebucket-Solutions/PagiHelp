# Consumer Usage Audit: Xley

This file records the additional `pagi-help` usage patterns observed in `/Users/abhinavgautam/Downloads/Xley-Backend-stage.zip`.

## Version alignment

- The audited application depends on `pagi-help@^1.0.43`.
- This repository is now versioned as `1.1.1`, while preserving the `1.0.43` runtime contract that the audited application depends on.

## Audit summary

The codebase contains:

- `21` `new PagiHelp(...)` constructions
- `21` `.paginate(...)` call sites
- `20` `countQuery` usages
- `3` `totalCountQuery` usages
- `19` `searchColumnList` blocks
- `20` `additionalWhereConditions` blocks
- `17` `statement:` usages
- `17` `joinQuery` usages
- `0` export flows using `replacements.splice(-2, 2, ...)`
- `0` `FIND_IN_SET` usages through the library
- `1` `JSON_OVERLAPS` appearance, but it is injected by downstream SQL rewriting rather than passed through `filters`

## New library-relevant usage patterns

### Raw dotted field names in `searchColumnList`

Observed usage:

- Call sites such as `searchColumnList: [{ name: "xg.group_name" }]`
- Call sites such as `searchColumnList: [{ name: "xmr.emoji" }, { name: "i.username" }]`

Implication:

- `columNames()` must continue to pass raw dotted names through unchanged when no `prefix` key is used.
- Search SQL generation must continue to emit those fields verbatim in `LIKE` clauses.

### Single-tuple `additionalWhereConditions`

Observed usage:

- Call sites such as `additionalWhereConditions: ["xmr.message_id", "=", messageId]`
- Call sites such as `additionalWhereConditions: ["cc.status", "!=", "Deleted"]`

Implication:

- `genSchema()` must keep accepting a single tuple directly, not only an array of tuples.
- This also means raw-mode conditions may render without outer parentheses when passed as a direct tuple, which is part of the current SQL shape.

### `joinQuery` is concatenated verbatim

Observed usage:

- Some call sites pass `joinQuery: "cc"` or `joinQuery: "xg"` without a leading space.
- Others pass full join fragments beginning with a space.

Implication:

- The library currently concatenates `joinQuery` directly after ``FROM `tableName``` with no normalization.
- This is a real downstream dependency on raw string concatenation, even if it is not an especially clean API shape.

### Downstream SQL string rewriting is common

Observed usage:

- Several Xley paths post-process generated `query` and `countQuery` strings by replacing `WHERE` or `SELECT` fragments.
- This mirrors the first audited application's habit of editing generated SQL strings directly.

Implication:

- Query-string formatting changes are compatibility-sensitive.
- Even when semantics stay the same, SQL string layout can matter to downstream consumers.

## What this audit did not add

- No new dependency on `FIND_IN_SET`
- No new dependency on `replacements.splice(-2, 2, ...)`
- No new dependency on grouped `totalCountQuery` rewriting beyond what was already documented from the first consumer audit

## Coverage added from this audit

The characterization suite now also covers:

- raw dotted search column names
- single-tuple `additionalWhereConditions`
