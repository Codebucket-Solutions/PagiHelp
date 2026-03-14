declare class PagiHelp {
  constructor(options?: PagiHelp.ConstructorOptions);

  columnNameConverter: (name: string) => string;

  columNames(arr: PagiHelp.ColumnDescriptor[]): string[];

  tupleCreator(
    tuple: PagiHelp.ConditionTuple,
    replacements: unknown[],
    asItIs?: boolean
  ): string;

  genSchema(
    schemaArray: PagiHelp.ConditionInput,
    replacements: unknown[],
    asItIs?: boolean
  ): string;

  normalizeFilters(
    filters?: PagiHelp.ConditionInput
  ): PagiHelp.ConditionInput | undefined;

  findColumnForFilter(
    field: string,
    columnList: PagiHelp.ColumnDescriptor[]
  ): PagiHelp.ColumnDescriptor | undefined;

  getFilterFieldName(column: PagiHelp.ColumnDescriptor): string;

  processFilterCondition(
    condition: PagiHelp.ConditionInput,
    columnList: PagiHelp.ColumnDescriptor[]
  ): PagiHelp.ConditionSchema;

  collectFilterConditions(
    filters: PagiHelp.ConditionInput | undefined,
    columnList: PagiHelp.ColumnDescriptor[]
  ): PagiHelp.ConditionSchema;

  buildSingleTableBaseQueries(
    tableName: string,
    joinQuery: string,
    columnList: string[]
  ): PagiHelp.BaseQueries;

  buildWhereQuery(
    paginationObject: PagiHelp.PaginationInput,
    searchColumnList: string[],
    filterConditions: PagiHelp.ConditionSchema,
    additionalWhereConditions: PagiHelp.ConditionInput | [],
    replacements: unknown[]
  ): string;

  singleTablePagination(
    tableName: string,
    paginationObject: PagiHelp.PaginationInput,
    searchColumnList: PagiHelp.SearchColumnDescriptor[],
    joinQuery?: string,
    columnList?: PagiHelp.ColumnDescriptor[],
    additionalWhereConditions?: PagiHelp.ConditionInput | []
  ): PagiHelp.PaginationResult;

  filler(data: PagiHelp.PaginationOption[]): PagiHelp.PaginationOption[];

  buildOrderByQuery(sort: PagiHelp.SortInput): string;

  stripTrailingUnionAll(query: string): string;

  buildTotalCountQuery(totalCountQueries: string[]): string;

  applyPagination(
    query: string,
    paginationObject: PagiHelp.PaginationInput,
    replacements: unknown[]
  ): string;

  paginate(
    paginationObject: PagiHelp.PaginationInput,
    options: PagiHelp.PaginationOption[]
  ): PagiHelp.PaginationResult;
}

declare namespace PagiHelp {
  interface ConstructorOptions {
    columnNameConverter?: (name: string) => string;
  }

  type SortDirection = "ASC" | "DESC" | "asc" | "desc";

  /**
   * Sort instructions for `paginate()`.
   *
   * Current runtime behavior:
   * - directions must resolve to `ASC` or `DESC`
   * - `paginate()` appends `id DESC` automatically
   * - the arrays are mutated in place
   */
  interface SortInput {
    attributes: string[];
    sorts: SortDirection[];
  }

  /**
   * One filter tuple in the form `[field, operator, value]`.
   *
   * Examples:
   * - `["status", "=", "Active"]`
   * - `["stage", "IN", ["NEW", "PROCESSING"]]`
   */
  type ConditionTuple = [field: string, operator: string, value: unknown];

  /**
   * Recursive filter tree.
   *
   * Semantics:
   * - top-level items are joined with `AND`
   * - nested arrays become `OR` groups
   */
  type ConditionSchema = Array<ConditionTuple | ConditionSchema>;

  type ConditionInput = ConditionTuple | ConditionSchema;

  /**
   * A normal selected column.
   *
   * - `name` is the physical database column name.
   * - `prefix` qualifies the column, for example `l.created_date`.
   * - `alias` is the logical output name used by callers for filters and sorts.
   */
  interface NamedColumnDescriptor {
    name: string;
    alias?: string;
    prefix?: string;
    statement?: never;
  }

  /**
   * A raw SQL expression or subquery selected verbatim.
   *
   * Use this instead of `name` for computed values.
   */
  interface StatementColumnDescriptor {
    statement: string;
    alias?: string;
    prefix?: never;
    name?: never;
  }

  type ColumnDescriptor = NamedColumnDescriptor | StatementColumnDescriptor;

  /**
   * A searchable column reference.
   *
   * `alias` is intentionally disallowed here because search expressions are
   * emitted directly into `WHERE ... LIKE ?`.
   */
  interface NamedSearchColumnDescriptor {
    name: string;
    prefix?: string;
    alias?: never;
    statement?: never;
  }

  /**
   * A searchable raw SQL expression or subquery emitted directly in `LIKE`.
   */
  interface StatementSearchColumnDescriptor {
    statement: string;
    alias?: never;
    prefix?: never;
    name?: never;
  }

  type SearchColumnDescriptor =
    | NamedSearchColumnDescriptor
    | StatementSearchColumnDescriptor;

  interface PaginationInput {
    search: string;
    /**
     * Filter input using the recursive tuple schema.
     *
     * Examples:
     * - `["status", "=", "Active"]`
     * - `[["status", "=", "Active"], ["createdDate", ">=", "2024-01-01"]]`
     * - `[["status", "=", "Active"], [["stage", "=", "NEW"], ["stage", "=", "PROCESSING"]]]`
     */
    filters?: ConditionInput;
    sort?: SortInput;
    /**
     * Page-based pagination. Offset is derived as `(pageNo - 1) * itemsPerPage`.
     */
    pageNo?: number;
    itemsPerPage?: number;
    /**
     * Offset-based pagination. Used when `pageNo/itemsPerPage` are not present.
     */
    offset?: number;
    limit?: number;
  }

  interface PaginationOption {
    /**
     * Physical table name used in the `FROM` clause.
     */
    tableName: string;
    /**
     * Selected output columns.
     *
     * Common shapes:
     * - `{ name, alias }`
     * - `{ name, prefix, alias }`
     * - `{ statement, alias }`
     */
    columnList: ColumnDescriptor[];
    /**
     * Searchable expressions used to generate `LIKE` clauses.
     *
     * Common shapes:
     * - `{ name }`
     * - `{ name, prefix }`
     * - `{ statement }`
     *
     * Avoid `alias` here.
     */
    searchColumnList: SearchColumnDescriptor[];
    /**
     * Raw SQL appended directly after ``FROM `tableName``` with no normalization.
     */
    joinQuery?: string;
    /**
     * Raw-mode conditions. Operators are not validated here.
     */
    additionalWhereConditions?: ConditionInput | [];
  }

  interface BaseQueries {
    query: string;
    countQuery: string;
    totalCountQuery: string;
  }

  interface PaginationResult {
    /**
     * Row-select query without `ORDER BY` / `LIMIT`.
     * This is not the aggregate count query.
     */
    countQuery: string;
    /**
     * Aggregate count query. Use this for actual total counts.
     */
    totalCountQuery: string;
    /**
     * Data query, with optional `ORDER BY` and `LIMIT`.
     */
    query: string;
    /**
     * Bound values for the generated queries.
     */
    replacements: unknown[];
  }
}

export = PagiHelp;
