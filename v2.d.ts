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
