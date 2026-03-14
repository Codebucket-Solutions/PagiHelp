import PagiHelp = require("./index");

declare class PagiHelpV210 extends PagiHelp {
  constructor(options?: PagiHelpV210.ConstructorOptions);

  dialect: PagiHelpV210.Dialect;

  defaultSafeOptions: PagiHelp.ResolvedSafePaginateOptions;

  validatePaginationObject(
    paginationObject: PagiHelpV210.PaginationInput
  ): PagiHelp.ValidationResult;

  validateOptions(
    options: PagiHelpV210.PaginationOption[]
  ): PagiHelp.ValidationResult;

  validatePaginationInput(
    paginationObject: PagiHelpV210.PaginationInput,
    options: PagiHelpV210.PaginationOption[]
  ): PagiHelp.ValidationResult;

  validateCursorPaginationInput(
    paginationObject: PagiHelpV210.CursorPaginationInput,
    options: PagiHelpV210.PaginationOption[]
  ): PagiHelp.ValidationResult;

  resolveSafeOptions(
    safeOptions?: PagiHelpV210.SafeOptions
  ): PagiHelp.ResolvedSafePaginateOptions;

  tupleCreator(
    tuple: PagiHelp.ConditionTuple,
    replacements: unknown[],
    asItIs?: boolean,
    safeOptions?: PagiHelpV210.SafeOptions
  ): string;

  genSchema(
    schemaArray: PagiHelp.ConditionInput,
    replacements: unknown[],
    asItIs?: boolean,
    safeOptions?: PagiHelpV210.SafeOptions
  ): string;

  processFilterCondition(
    condition: PagiHelp.ConditionInput,
    columnList: PagiHelp.ColumnDescriptor[]
  ): PagiHelp.ConditionSchema;

  collectFilterConditions(
    filters: PagiHelp.ConditionInput | undefined,
    columnList: PagiHelp.ColumnDescriptor[]
  ): PagiHelp.ConditionSchema;

  buildOrderByQuery(sort: PagiHelp.SortInput): string;

  buildSingleTableBaseQueries(
    tableName: string,
    joinQuery: string,
    columnList: string[],
    safeOptions?: PagiHelpV210.SafeOptions
  ): PagiHelp.BaseQueries;

  buildWhereQuery(
    paginationObject: PagiHelpV210.PaginationInput,
    searchColumnList: string[] | undefined,
    filterConditions: PagiHelp.ConditionSchema,
    additionalWhereConditions: PagiHelp.ConditionInput | [],
    replacements: unknown[],
    safeOptions?: PagiHelpV210.SafeOptions
  ): string;

  singleTablePagination(
    tableName: string,
    paginationObject: PagiHelpV210.PaginationInput,
    searchColumnList?: PagiHelp.SearchColumnDescriptor[],
    joinQuery?: string,
    columnList?: PagiHelp.ColumnDescriptor[],
    additionalWhereConditions?: PagiHelp.ConditionInput | [],
    safeOptions?: PagiHelpV210.SafeOptions
  ): PagiHelp.PaginationResult;

  paginate(
    paginationObject: PagiHelpV210.PaginationInput,
    options: PagiHelpV210.PaginationOption[],
    safeOptions?: PagiHelpV210.SafeOptions
  ): PagiHelp.PaginationResult;

  paginateSafe(
    paginationObject: PagiHelpV210.PaginationInput,
    options: PagiHelpV210.PaginationOption[],
    safeOptions?: PagiHelpV210.SafeOptions
  ): PagiHelp.PaginationResult;

  /**
   * Phase-1 token pagination for the hardened `v2` path.
   *
   * Rules:
   * - exactly one option block
   * - `sort` is required
   * - `limit` is required
   * - `after` is supported
   * - `before`, `pageNo`, `itemsPerPage`, and `offset` are rejected
   */
  paginateCursor(
    paginationObject: PagiHelpV210.CursorPaginationInput,
    options: PagiHelpV210.PaginationOption[],
    safeOptions?: PagiHelpV210.SafeOptions
  ): PagiHelpV210.CursorPaginationResult;

  /**
   * Trim the extra fetched row and derive cursor metadata.
   */
  resolveCursorPage<Row extends Record<string, unknown>>(
    rows: Row[],
    cursorPlan: PagiHelpV210.CursorPlan
  ): PagiHelpV210.CursorPage<Row>;

  /**
   * Encode an opaque `after` token from one query row.
   */
  encodeCursorFromRow(
    row: Record<string, unknown>,
    cursorPlan: PagiHelpV210.CursorPlan
  ): string;

  /**
   * Decode and validate the token envelope.
   */
  decodeCursor(cursorToken: string): PagiHelpV210.DecodedCursorToken;

  paginateLegacy(
    paginationObject: PagiHelp.PaginationInput,
    options: PagiHelp.PaginationOption[]
  ): PagiHelp.PaginationResult;
}

declare namespace PagiHelpV210 {
  type Dialect = "mysql" | "postgres";

  interface SafeOptions {
    validate?: boolean;
  }

  interface PaginationInput extends Omit<PagiHelp.PaginationInput, "search"> {
    search?: string;
  }

  interface PaginationOption
    extends Omit<PagiHelp.PaginationOption, "searchColumnList"> {
    searchColumnList?: PagiHelp.SearchColumnDescriptor[];
  }

  interface CursorPaginationInput
    extends Omit<
      PaginationInput,
      "pageNo" | "itemsPerPage" | "offset" | "sort"
    > {
    /**
     * Required deterministic ordering for cursor mode.
     *
     * `id` is appended automatically as the final tie-breaker when needed.
     */
    sort: PagiHelp.SortInput;
    /**
     * Requested page size. The generated SQL fetches `limit + 1`.
     */
    limit: number;
    /**
     * Opaque token returned from a prior cursor page.
     */
    after?: string;
    /**
     * Reserved for a future phase. Rejected in the current runtime.
     */
    before?: string;
  }

  interface CursorSortField {
    attribute: string;
    direction: PagiHelp.SortDirection;
  }

  interface CursorPlan {
    version: 1;
    dialect: Dialect;
    direction: "forward";
    requestedLimit: number;
    /**
     * Actual SQL fetch size. This is always `requestedLimit + 1`.
     */
    fetchLimit: number;
    normalizedSort: CursorSortField[];
    cursorAliases: string[];
    queryFingerprint: string;
    after: string | null;
  }

  interface CursorPaginationResult extends PagiHelp.PaginationResult {
    /**
     * Cursor metadata consumed by `resolveCursorPage()` and `encodeCursorFromRow()`.
     */
    cursorPlan: CursorPlan;
  }

  interface CursorPageInfo {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
    nextCursor: string | null;
  }

  interface CursorPage<Row extends Record<string, unknown>> {
    rows: Row[];
    pageInfo: CursorPageInfo;
  }

  interface DecodedCursorToken {
    v: 1;
    d: Dialect;
    fp: string;
    s: [attribute: string, direction: PagiHelp.SortDirection][];
    values: unknown[];
    dir: "after";
  }

  interface ConstructorOptions extends PagiHelp.ConstructorOptions {
    /**
     * SQL dialect for the hardened `v2` path.
     *
     * - `mysql` keeps the current MySQL SQL renderer
     * - `postgres` switches `FROM`, `ORDER BY`, operators, and pagination to PostgreSQL SQL
     *
     * Default: `mysql`
     */
    dialect?: Dialect;
    safeOptions?: SafeOptions;
  }
}

export = PagiHelpV210;
