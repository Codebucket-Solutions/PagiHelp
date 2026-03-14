# PagiHelp Commit History Notes

This file traces the repository history commit by commit and maps each behavior-changing change to current coverage in `test/characterization.test.js`. The goal is to make future edits safer by distinguishing current contract, historical evolution, and non-runtime commits.

## Reading guide

- "Current status" describes what survives in `index.js` today.
- "Coverage" lists the characterization tests that currently exercise the behavior.
- "No dedicated test" is used only for commits that changed metadata or introduced an internal quirk that is not a stable user-facing contract.

## Runtime-changing commits

### `29cda96` (2023-01-22) `first push`

Initial release. Introduced the exported `PagiHelp` class and the base architecture:

- `paginate()` returning `query`, `countQuery`, and `replacements`
- multi-table `UNION ALL` support through `filler()`
- `pageNo` / `itemsPerPage` pagination
- search across configured `searchColumnList`
- nested filter arrays
- `columnNameConverter`
- automatic `id desc` tie-breaker for sorted results
- `additionalWhereConditions`

Historical note:

- At this point filters were emitted in a `HAVING` clause instead of being mapped back into `WHERE`.
- Missing union aliases were filled with `''`, not `(NULL)`.

Current status:

- The overall API shape remains, but filter handling and union padding were changed later.

Coverage:

- `basic single-table pagination matches current SQL output`
- `multi-table mode pads missing aliases and aggregates total counts`
- `filters resolve camelCase aliases and special operators keep current SQL shape`

### `2a0b51c` (2023-01-23) `1.0.7`

Changed alias ordering inside `filler()` from lexical sort to numeric subtraction sort.

Current status:

- The code still numerically orders numeric-like aliases, which affects how union columns are aligned when aliases such as `"2"` and `"10"` are used.
- For plain string aliases this comparator is not a strong contract and should be treated as an implementation quirk.

Coverage:

- `filler keeps numeric-like aliases in numeric order when aligning union columns`

### `3a45509` (2023-01-23) `added libraries for security`

First security-oriented hardening pass.

- Added `sqlstring`
- introduced the operator allow-list
- changed union placeholder columns from `''` to `(NULL)`

Current status:

- Operator validation remains.
- `(NULL)` placeholder padding remains and is part of current union behavior.
- The original field escaping from this commit was later revised again.

Coverage:

- `invalid filter fields, operators, and sort values throw the current string errors`
- `multi-table mode pads missing aliases and aggregates total counts`

### `9aa5bbc` (2023-01-23) `added security`

Adjusted tuple handling so raw-mode conditions (`asItIs`) bypass operator validation and column escaping, while normal filters still use escaped identifiers.

Current status:

- The raw-mode bypass remains important because `additionalWhereConditions` depends on it.
- The field escaping detail from this commit was later superseded by commit `461dda8`, which stopped escaping tuple fields inside `tupleCreator`.

Coverage:

- `additionalWhereConditions can inline parenthesized subqueries`
- `additionalWhereConditions bypass operator allow-list in raw mode`

### `22b5cba` (2023-01-23) `added libraries for security`

Hardened sorting behavior.

- Added `ASC` / `DESC` allow-list for sort directions
- normalized sort directions to uppercase
- switched `ORDER BY` field rendering to `sqlstring.escapeId()`

Current status:

- Sort validation and uppercase normalization remain.
- The escaped-id rendering still happens before `columnNameConverter()` in `paginate()`.

Coverage:

- `basic single-table pagination matches current SQL output`
- `filters resolve camelCase aliases and special operators keep current SQL shape`
- `invalid filter fields, operators, and sort values throw the current string errors`

### `d91ab34` (2024-12-04) `Update index.js`

Added several runtime capabilities.

- Added `JSON_CONTAINS`
- skipped search generation when `searchColumnList` is empty
- added `offset` / `limit` pagination mode alongside `pageNo` / `itemsPerPage`

Current status:

- `JSON_CONTAINS` remains supported.
- `offset` / `limit` remains supported.
- Empty `searchColumnList` works, but an omitted `searchColumnList` still throws because `.map()` is still called unconditionally.

Coverage:

- `filters resolve camelCase aliases and special operators keep current SQL shape`
- `multi-table mode pads missing aliases and aggregates total counts`

### `b61e90d` (2025-05-12) `add totalCountQuery functionality. (#1)`

Major behavior rewrite.

- Added `totalCountQuery`
- moved filter logic from `HAVING` to `WHERE`
- translated filter aliases back to actual columns/statements before rendering
- introduced statement-aware filtering
- added snake_case to camelCase alias matching for filters

Historical note:

- This commit appended translated filters directly into `additionalWhereConditions`; later commits separated them again.
- Missing filter fields still failed silently here and were tightened later.

Current status:

- `totalCountQuery` remains the authoritative aggregate count query.
- Alias-to-field translation remains and is now stricter.

Coverage:

- `basic single-table pagination matches current SQL output`
- `filters resolve camelCase aliases and special operators keep current SQL shape`

### `61baf32` (2025-08-24) `Improve JSON_CONTAINS & add FIND_IN_SET support (#2)`

Extended filter/operator support.

- normalized a single filter tuple into array form
- improved `JSON_CONTAINS` binding for object values
- added `FIND_IN_SET`

Current status:

- All three behaviors remain.

Coverage:

- `filters resolve camelCase aliases and special operators keep current SQL shape`
- `single filter tuples are normalized into array form`

### `83e2a8e` (2025-08-26) `Improve pagination: aggregate totalCount & trim UNION ALL (#3)`

Fixed union counting and query assembly.

- changed multi-table `totalCountQuery` from a union of counts into `SELECT SUM(countValue) ...`
- replaced fragile trailing `UNION ALL` trimming with a more robust approach for `query` and `countQuery`

Current status:

- Both improvements remain.

Coverage:

- `multi-table mode pads missing aliases and aggregates total counts`

### `3ae218d` (2025-08-28) `fix: add subquery support in tupleCreator (#4)`

Allowed parenthesized string values such as `"(SELECT ...)"` to be emitted directly instead of parameterized.

Historical note:

- This initially applied to all tuple handling.
- Commit `2be95fe` narrowed the behavior so direct inlining only remains for raw-mode conditions (`additionalWhereConditions`).

Current status:

- Raw-mode subquery inlining remains.
- Regular filters no longer inline parenthesized strings.

Coverage:

- `additionalWhereConditions can inline parenthesized subqueries`
- `parenthesized filter values stay parameterized in regular filters`

### `2be95fe` (2025-09-10) `fix: allow subqueries in additionalWhereConditions while keeping filters parameterized (#5)`

Important safety and correctness pass.

- restored operator validation only for non-raw mode
- kept raw subqueries for `additionalWhereConditions` while parameterizing normal filters
- improved recursive `genSchema()` so raw-mode propagation survives nesting
- added exact alias matching before snake_case/camelCase fallback
- added `prefix.name` filter matching
- started throwing on invalid filter fields
- skipped search `LIKE` clauses when `search === ""`

Current status:

- All of those behaviors remain.

Coverage:

- `filters resolve camelCase aliases and special operators keep current SQL shape`
- `additionalWhereConditions can inline parenthesized subqueries`
- `parenthesized filter values stay parameterized in regular filters`
- `invalid filter fields, operators, and sort values throw the current string errors`
- `multi-table mode pads missing aliases and aggregates total counts`
- `additionalWhereConditions bypass operator allow-list in raw mode`

### `461dda8` (2025-09-11) `feat: support JSON_OVERLAPS and allow raw field names (#6)`

Latest runtime feature commit.

- added `JSON_OVERLAPS`
- removed `escapeId()` from tuple field handling so mapped/prefixed/raw field names are emitted directly

Current status:

- `JSON_OVERLAPS` remains supported.
- Direct raw field rendering remains and is necessary for generated fields like `l.meta_info`.

Coverage:

- `json_overlaps is supported and stringifies object values`
- `filters resolve camelCase aliases and special operators keep current SQL shape`

## Non-runtime commits

### `0f6aa2b` (2023-01-22) `first push`

- README title changed from `Pagi Help` to `PagiHelp`.
- No runtime impact.

### `f1d7808` (2023-01-22) `Update README.md`

- README diagram link changed to a GitHub URL.
- No runtime impact.

### `0a1daf4` (2023-01-22) `version 1.0.6`

- Package metadata update.
- Added repository metadata and bumped version.
- No runtime impact.

### `1820b22` (2024-12-04) `Update package.json`

- Version bump to `1.0.20`.
- No runtime impact.

## Coverage summary

Runtime-affecting commits with dedicated or indirect regression coverage:

- `29cda96`
- `2a0b51c`
- `3a45509`
- `9aa5bbc`
- `22b5cba`
- `d91ab34`
- `b61e90d`
- `61baf32`
- `83e2a8e`
- `3ae218d`
- `2be95fe`
- `461dda8`

Commits with no runtime effect are documented above and intentionally do not need tests.
