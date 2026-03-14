import PagiHelp = require("./index");

declare class PagiHelpV210 extends PagiHelp {
  constructor(options?: PagiHelpV210.ConstructorOptions);

  defaultSafeOptions: PagiHelp.ResolvedSafePaginateOptions;

  resolveSafeOptions(
    safeOptions?: PagiHelp.SafePaginateOptions
  ): PagiHelp.ResolvedSafePaginateOptions;

  tupleCreator(
    tuple: PagiHelp.ConditionTuple,
    replacements: unknown[],
    asItIs?: boolean,
    safeOptions?: PagiHelp.SafePaginateOptions
  ): string;

  genSchema(
    schemaArray: PagiHelp.ConditionInput,
    replacements: unknown[],
    asItIs?: boolean,
    safeOptions?: PagiHelp.SafePaginateOptions
  ): string;

  buildSingleTableBaseQueries(
    tableName: string,
    joinQuery: string,
    columnList: string[],
    safeOptions?: PagiHelp.SafePaginateOptions
  ): PagiHelp.BaseQueries;

  buildWhereQuery(
    paginationObject: PagiHelp.PaginationInput,
    searchColumnList: string[],
    filterConditions: PagiHelp.ConditionSchema,
    additionalWhereConditions: PagiHelp.ConditionInput | [],
    replacements: unknown[],
    safeOptions?: PagiHelp.SafePaginateOptions
  ): string;

  singleTablePagination(
    tableName: string,
    paginationObject: PagiHelp.PaginationInput,
    searchColumnList: PagiHelp.SearchColumnDescriptor[],
    joinQuery?: string,
    columnList?: PagiHelp.ColumnDescriptor[],
    additionalWhereConditions?: PagiHelp.ConditionInput | [],
    safeOptions?: PagiHelp.SafePaginateOptions
  ): PagiHelp.PaginationResult;

  paginate(
    paginationObject: PagiHelp.PaginationInput,
    options: PagiHelp.PaginationOption[],
    safeOptions?: PagiHelp.SafePaginateOptions
  ): PagiHelp.PaginationResult;

  paginateSafe(
    paginationObject: PagiHelp.PaginationInput,
    options: PagiHelp.PaginationOption[],
    safeOptions?: PagiHelp.SafePaginateOptions
  ): PagiHelp.PaginationResult;

  paginateLegacy(
    paginationObject: PagiHelp.PaginationInput,
    options: PagiHelp.PaginationOption[]
  ): PagiHelp.PaginationResult;
}

declare namespace PagiHelpV210 {
  interface ConstructorOptions extends PagiHelp.ConstructorOptions {
    safeOptions?: PagiHelp.SafePaginateOptions;
  }
}

export = PagiHelpV210;
