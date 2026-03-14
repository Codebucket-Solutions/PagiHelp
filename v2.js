const PagiHelp = require("./index");

const mysqlDialect = require("./v2/dialects/mysql");
const postgresDialect = require("./v2/dialects/postgres");

const fixedV2SafeOptions = Object.freeze({
  cloneSort: true,
  cloneOptions: true,
  normalizeJoinQuery: true,
  coerceUndefinedSearchToEmpty: true,
  omitEmptyWhere: true,
  rejectSearchAliases: true,
  emptyInStrategy: "throw",
  countQueryMode: "aggregate",
});

const defaultV2SafeOptions = Object.freeze({
  validate: true,
});

const supportedV2SafeOptionKeys = new Set(["validate"]);
const supportedDialects = Object.freeze({
  mysql: mysqlDialect,
  postgres: postgresDialect,
});
const allowedOperators = new Set([
  ">",
  ">=",
  "<",
  "<=",
  "=",
  "!=",
  "<>",
  "IN",
  "NOT IN",
  "! IN",
  "IS",
  "IS NOT",
  "LIKE",
  "RLIKE",
  "MEMBER OF",
  "JSON_CONTAINS",
  "JSON_OVERLAPS",
  "FIND_IN_SET",
]);
const allowedSorts = new Set(["ASC", "DESC"]);

class PagiHelpV210 extends PagiHelp {
  constructor(options = {}) {
    const { safeOptions, dialect, ...legacyOptions } = options || {};
    super(legacyOptions);

    const legacyValidatePaginationObject =
      this.validatePaginationObject.bind(this);
    const legacyValidateOptions = this.validateOptions.bind(this);
    const legacyValidatePaginationInput = this.validatePaginationInput.bind(this);
    const legacyGenSchema = this.genSchema.bind(this);
    const legacyBuildSafeWhereQuery = this.buildSafeWhereQuery.bind(this);
    const legacySingleTablePaginationSafe =
      this.singleTablePaginationSafe.bind(this);
    const legacyPaginateSafe = this.paginateSafe.bind(this);
    const legacyProcessFilterCondition = this.processFilterCondition.bind(this);
    const legacyCollectFilterConditions = this.collectFilterConditions.bind(this);

    this.toError = (error) =>
      error instanceof Error ? error : new Error(String(error));

    this.normalizeDialect = (value = "mysql", path = "dialect") => {
      if (typeof value !== "string" || value.trim() === "") {
        throw new Error(`${path} must be "mysql" or "postgres"`);
      }

      const normalizedDialect = value.toLowerCase();
      if (!supportedDialects[normalizedDialect]) {
        throw new Error(`${path} must be "mysql" or "postgres"`);
      }

      return normalizedDialect;
    };

    this.dialect = this.normalizeDialect(dialect || "mysql", "constructor.dialect");
    this.dialectAdapter = supportedDialects[this.dialect];

    this.assertSupportedV2SafeOptions = (
      safeOptionsObject = {},
      path = "safeOptions"
    ) => {
      for (const key of Object.keys(safeOptionsObject || {})) {
        if (!supportedV2SafeOptionKeys.has(key)) {
          throw new Error(
            `PagiHelpV2 does not allow ${path}.${key}; use paginateLegacy() for legacy behavior`
          );
        }
      }
    };

    this.normalizeV2SafeOptions = (
      safeOptionsObject = {},
      path = "safeOptions"
    ) => {
      this.assertSupportedV2SafeOptions(safeOptionsObject, path);

      return this.normalizeSafePaginateOptions({
        ...fixedV2SafeOptions,
        ...defaultV2SafeOptions,
        validate:
          safeOptionsObject.validate ?? defaultV2SafeOptions.validate,
      });
    };

    this.normalizeV2PaginationObject = (paginationObject = {}) => {
      const normalizedPaginationObject = {
        ...(paginationObject || {}),
      };

      if (normalizedPaginationObject.search === undefined) {
        normalizedPaginationObject.search = "";
      }

      return normalizedPaginationObject;
    };

    this.normalizeV2Option = (option) => {
      if (!option || typeof option !== "object" || Array.isArray(option)) {
        return option;
      }

      return {
        ...option,
        searchColumnList:
          option.searchColumnList === undefined ? [] : option.searchColumnList,
      };
    };

    this.normalizeV2Options = (inputOptions = []) => {
      if (!Array.isArray(inputOptions)) {
        return inputOptions;
      }

      return inputOptions.map((option) => this.normalizeV2Option(option));
    };

    this.filterLegacyValidationWarnings = (validationResult) => ({
      ...validationResult,
      warnings: validationResult.warnings.filter(
        (warning) =>
          warning !==
            'paginationObject.search is undefined; current paginate() will search for "%undefined%" when searchColumnList is non-empty' &&
          warning !== "paginationObject.sort will be mutated by paginate()"
      ),
    });

    this.defaultSafeOptions = this.normalizeV2SafeOptions(
      safeOptions,
      "constructor.safeOptions"
    );

    this.resolveSafeOptions = (overrides = {}) =>
      this.normalizeV2SafeOptions(
        {
          validate:
            overrides.validate !== undefined
              ? overrides.validate
              : this.defaultSafeOptions.validate,
          ...overrides,
        },
        "safeOptions"
      );

    this.validatePaginationObject = (paginationObject) =>
      this.filterLegacyValidationWarnings(
        legacyValidatePaginationObject(
          this.normalizeV2PaginationObject(paginationObject)
        )
      );

    this.validateOptions = (inputOptions) =>
      this.filterLegacyValidationWarnings(
        legacyValidateOptions(this.normalizeV2Options(inputOptions))
      );

    this.validatePaginationInput = (paginationObject, inputOptions) =>
      this.filterLegacyValidationWarnings(
        legacyValidatePaginationInput(
          this.normalizeV2PaginationObject(paginationObject),
          this.normalizeV2Options(inputOptions)
        )
      );

    this.processFilterCondition = (condition, columnList) => {
      try {
        return legacyProcessFilterCondition(condition, columnList);
      } catch (error) {
        throw this.toError(error);
      }
    };

    this.collectFilterConditions = (filters, columnList) => {
      try {
        return legacyCollectFilterConditions(filters, columnList);
      } catch (error) {
        throw this.toError(error);
      }
    };

    this.buildOrderByQuery = (sort) => {
      const clonedSort =
        sort && typeof sort === "object"
          ? {
              ...sort,
              attributes: Array.isArray(sort.attributes)
                ? [...sort.attributes]
                : sort.attributes,
              sorts: Array.isArray(sort.sorts)
                ? [...sort.sorts]
                : sort.sorts,
            }
          : sort;

      try {
        let orderByQuery = "ORDER BY ";

        for (let index = 0; index < clonedSort.sorts.length; index += 1) {
          const normalizedSort = clonedSort.sorts[index].toUpperCase();
          if (!allowedSorts.has(normalizedSort)) {
            throw new Error("INVALID SORT VALUE");
          }
          clonedSort.sorts[index] = normalizedSort;
        }

        for (let index = 0; index < clonedSort.attributes.length; index += 1) {
          const convertedAttribute = this.columnNameConverter(
            clonedSort.attributes[index]
          );

          orderByQuery +=
            this.dialectAdapter.quoteIdentifier(convertedAttribute) +
            clonedSort.sorts[index] +
            ",";
        }

        return orderByQuery.slice(0, -1);
      } catch (error) {
        throw this.toError(error);
      }
    };

    this.tupleCreator = (
      tuple,
      replacements,
      asItIs = false,
      overrideSafeOptions = {}
    ) => {
      const operator = tuple[1]?.toUpperCase?.();
      const value = tuple[2];

      try {
        this.resolveSafeOptions(overrideSafeOptions);

        if (!asItIs && (!operator || !allowedOperators.has(operator))) {
          throw new Error("Invalid Operator");
        }

        if (
          Array.isArray(value) &&
          value.length === 0 &&
          ["IN", "NOT IN", "! IN"].includes(operator)
        ) {
          throw new Error(
            `${operator} does not accept an empty array in PagiHelpV2`
          );
        }

        return this.dialectAdapter.buildTuple(tuple, replacements, asItIs);
      } catch (error) {
        throw this.toError(error);
      }
    };

    this.genSchema = (
      schemaArray,
      replacements,
      asItIs = false,
      overrideSafeOptions = {}
    ) => {
      try {
        this.resolveSafeOptions(overrideSafeOptions);
        return legacyGenSchema(schemaArray, replacements, asItIs);
      } catch (error) {
        throw this.toError(error);
      }
    };

    this.buildSafeBaseQueries = (
      tableName,
      joinQuery,
      columnList,
      countQueryMode = "aggregate"
    ) => {
      try {
        return this.dialectAdapter.buildBaseQueries(
          tableName,
          joinQuery,
          columnList,
          countQueryMode
        );
      } catch (error) {
        throw this.toError(error);
      }
    };

    this.buildSingleTableBaseQueries = (
      tableName,
      joinQuery,
      columnList,
      overrideSafeOptions = {}
    ) => {
      const safeOptionsObject = this.resolveSafeOptions(overrideSafeOptions);

      try {
        return this.buildSafeBaseQueries(
          tableName,
          this.normalizeSafeJoinQuery(joinQuery),
          columnList,
          safeOptionsObject.countQueryMode
        );
      } catch (error) {
        throw this.toError(error);
      }
    };

    this.buildWhereQuery = (
      paginationObject,
      searchColumnList,
      filterConditions,
      additionalWhereConditions,
      replacements,
      overrideSafeOptions = {}
    ) => {
      try {
        return legacyBuildSafeWhereQuery(
          this.normalizeV2PaginationObject(paginationObject),
          searchColumnList || [],
          filterConditions || [],
          additionalWhereConditions || [],
          replacements,
          this.resolveSafeOptions(overrideSafeOptions)
        );
      } catch (error) {
        throw this.toError(error);
      }
    };

    this.applyPagination = (query, paginationObject, replacements) => {
      try {
        return this.dialectAdapter.applyPagination(
          query,
          paginationObject,
          replacements
        );
      } catch (error) {
        throw this.toError(error);
      }
    };

    this.singleTablePagination = (
      tableName,
      paginationObject,
      searchColumnList = [],
      joinQuery = "",
      columnList = [{ name: "*" }],
      additionalWhereConditions = [],
      overrideSafeOptions = {}
    ) => {
      try {
        return legacySingleTablePaginationSafe(
          tableName,
          this.normalizeV2PaginationObject(paginationObject),
          searchColumnList || [],
          this.normalizeSafeJoinQuery(joinQuery),
          columnList,
          additionalWhereConditions || [],
          this.resolveSafeOptions(overrideSafeOptions)
        );
      } catch (error) {
        throw this.toError(error);
      }
    };

    this.paginate = (paginationObject, options, overrideSafeOptions = {}) => {
      try {
        return legacyPaginateSafe(
          this.normalizeV2PaginationObject(paginationObject),
          this.normalizeV2Options(options),
          this.resolveSafeOptions(overrideSafeOptions)
        );
      } catch (error) {
        throw this.toError(error);
      }
    };

    this.paginateSafe = this.paginate;

    this.paginateLegacy = (paginationObject, options) => {
      try {
        return new PagiHelp({
          columnNameConverter: this.columnNameConverter,
        }).paginate(paginationObject, options);
      } catch (error) {
        throw this.toError(error);
      }
    };
  }
}

module.exports = PagiHelpV210;
module.exports.PagiHelpV210 = PagiHelpV210;
module.exports.PagiHelpV2 = PagiHelpV210;
