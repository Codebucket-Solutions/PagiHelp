const PagiHelp = require("./index");

const defaultV210Options = Object.freeze({
  cloneSort: true,
  cloneOptions: true,
  normalizeJoinQuery: true,
  coerceUndefinedSearchToEmpty: true,
  omitEmptyWhere: true,
  rejectSearchAliases: true,
  emptyInStrategy: "throw",
  countQueryMode: "aggregate",
  validate: true,
});

class PagiHelpV210 extends PagiHelp {
  constructor(options = {}) {
    const { safeOptions, ...legacyOptions } = options || {};
    super(legacyOptions);
    const legacyTupleCreatorSafe = this.tupleCreatorSafe.bind(this);
    const legacyGenSchemaSafe = this.genSchemaSafe.bind(this);
    const legacyBuildSafeBaseQueries = this.buildSafeBaseQueries.bind(this);
    const legacyBuildSafeWhereQuery = this.buildSafeWhereQuery.bind(this);
    const legacySingleTablePaginationSafe =
      this.singleTablePaginationSafe.bind(this);
    const legacyPaginateSafe = this.paginateSafe.bind(this);

    this.defaultSafeOptions = this.normalizeSafePaginateOptions({
      ...defaultV210Options,
      ...safeOptions,
    });

    this.resolveSafeOptions = (overrides = {}) =>
      this.normalizeSafePaginateOptions({
        ...this.defaultSafeOptions,
        ...overrides,
      });

    this.tupleCreator = (
      tuple,
      replacements,
      asItIs = false,
      overrideSafeOptions = {}
    ) =>
      legacyTupleCreatorSafe(
        tuple,
        replacements,
        asItIs,
        this.resolveSafeOptions(overrideSafeOptions)
      );

    this.genSchema = (
      schemaArray,
      replacements,
      asItIs = false,
      overrideSafeOptions = {}
    ) =>
      legacyGenSchemaSafe(
        schemaArray,
        replacements,
        asItIs,
        this.resolveSafeOptions(overrideSafeOptions)
      );

    this.buildSingleTableBaseQueries = (
      tableName,
      joinQuery,
      columnList,
      overrideSafeOptions = {}
    ) =>
      legacyBuildSafeBaseQueries(
        tableName,
        joinQuery,
        columnList,
        this.resolveSafeOptions(overrideSafeOptions).countQueryMode
      );

    this.buildWhereQuery = (
      paginationObject,
      searchColumnList,
      filterConditions,
      additionalWhereConditions,
      replacements,
      overrideSafeOptions = {}
    ) =>
      legacyBuildSafeWhereQuery(
        paginationObject,
        searchColumnList,
        filterConditions,
        additionalWhereConditions,
        replacements,
        this.resolveSafeOptions(overrideSafeOptions)
      );

    this.singleTablePagination = (
      tableName,
      paginationObject,
      searchColumnList,
      joinQuery = "",
      columnList = [{ name: "*" }],
      additionalWhereConditions = [],
      overrideSafeOptions = {}
    ) =>
      legacySingleTablePaginationSafe(
        tableName,
        paginationObject,
        searchColumnList,
        joinQuery,
        columnList,
        additionalWhereConditions,
        this.resolveSafeOptions(overrideSafeOptions)
      );

    this.paginate = (paginationObject, options, overrideSafeOptions = {}) =>
      legacyPaginateSafe(
        paginationObject,
        options,
        this.resolveSafeOptions(overrideSafeOptions)
      );

    this.paginateSafe = this.paginate;

    this.paginateLegacy = (paginationObject, options) =>
      new PagiHelp({
        columnNameConverter: this.columnNameConverter,
      }).paginate(paginationObject, options);
  }
}

module.exports = PagiHelpV210;
module.exports.PagiHelpV210 = PagiHelpV210;
module.exports.PagiHelpV2 = PagiHelpV210;
