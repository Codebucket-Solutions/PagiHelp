const crypto = require("crypto");

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
const allowedSorts = new Set(["ASC", "DESC"]);
const cursorTokenVersion = 1;

const stableSerialize = (value) => {
  if (value === undefined) {
    return "null";
  }

  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
  }

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
    .join(",")}}`;
};

const encodeBase64Url = (value) =>
  Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const decodeBase64Url = (value) => {
  const normalizedValue = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalizedValue.length % 4;
  const paddedValue =
    padding === 0 ? normalizedValue : normalizedValue + "=".repeat(4 - padding);
  return Buffer.from(paddedValue, "base64").toString("utf8");
};

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

    this.normalizeCursorPaginationObject = (paginationObject = {}) =>
      this.normalizeV2PaginationObject(paginationObject);

    this.normalizeCursorSort = (sort) => {
      if (!sort || typeof sort !== "object" || Array.isArray(sort)) {
        throw new Error("cursorPaginationObject.sort must be an object");
      }

      if (!Array.isArray(sort.attributes) || sort.attributes.length === 0) {
        throw new Error(
          "cursorPaginationObject.sort.attributes must be a non-empty array"
        );
      }

      if (!Array.isArray(sort.sorts) || sort.sorts.length === 0) {
        throw new Error(
          "cursorPaginationObject.sort.sorts must be a non-empty array"
        );
      }

      if (sort.attributes.length !== sort.sorts.length) {
        throw new Error(
          "cursorPaginationObject.sort.attributes and cursorPaginationObject.sort.sorts must have the same length"
        );
      }

      const attributes = [...sort.attributes];
      const sorts = sort.sorts.map((direction) => {
        const normalizedDirection = String(direction).toUpperCase();
        if (!allowedSorts.has(normalizedDirection)) {
          throw new Error("INVALID SORT VALUE");
        }
        return normalizedDirection;
      });

      return {
        attributes,
        sorts,
      };
    };

    this.resolveCursorSortColumns = (sort, option) => {
      const normalizedSort = this.normalizeCursorSort(sort);
      const cursorSort = [];

      for (let index = 0; index < normalizedSort.attributes.length; index += 1) {
        const attribute = normalizedSort.attributes[index];
        const column = this.findColumnForFilter(attribute, option.columnList);

        if (!column) {
          throw new Error(
            `cursor sort attribute "${attribute}" is not present in option.columnList`
          );
        }

        if (!column.alias) {
          throw new Error(
            `cursor sort attribute "${attribute}" must resolve to a columnList entry with an alias`
          );
        }

        cursorSort.push({
          attribute,
          alias: column.alias,
          direction: normalizedSort.sorts[index],
          field: this.getFilterFieldName(column),
        });
      }

      const hasIdAlias = option.columnList.some((column) => column.alias === "id");
      if (!hasIdAlias) {
        throw new Error(
          'cursor pagination requires option.columnList to include alias "id"'
        );
      }

      if (!cursorSort.some((entry) => entry.alias === "id")) {
        const idColumn = option.columnList.find((column) => column.alias === "id");
        cursorSort.push({
          attribute: "id",
          alias: "id",
          direction: cursorSort[cursorSort.length - 1].direction,
          field: this.getFilterFieldName(idColumn),
        });
      }

      return cursorSort;
    };

    this.appendConditionToQuery = (query, condition) => {
      if (!condition) {
        return query;
      }

      return /\sWHERE\s/i.test(query)
        ? `${query} AND ${condition}`
        : `${query} WHERE ${condition}`;
    };

    this.getCursorComparisonOperator = (direction, cursorDirection = "after") => {
      if (cursorDirection !== "after") {
        throw new Error('Only cursor direction "after" is supported');
      }

      return direction === "ASC" ? ">" : "<";
    };

    this.wrapCursorField = (field) =>
      field.startsWith("(") && field.endsWith(")") ? field : `(${field})`;

    this.buildCursorPredicate = (cursorSort, cursorValues, cursorDirection = "after") => {
      const clauses = [];
      const replacements = [];

      for (let index = 0; index < cursorSort.length; index += 1) {
        const parts = [];

        for (let previousIndex = 0; previousIndex < index; previousIndex += 1) {
          parts.push(
            `${this.wrapCursorField(cursorSort[previousIndex].field)} = ?`
          );
          replacements.push(cursorValues[previousIndex]);
        }

        parts.push(
          `${this.wrapCursorField(cursorSort[index].field)} ${this.getCursorComparisonOperator(
            cursorSort[index].direction,
            cursorDirection
          )} ?`
        );
        replacements.push(cursorValues[index]);

        clauses.push(parts.length > 1 ? `(${parts.join(" AND ")})` : parts[0]);
      }

      return {
        query: `(${clauses.join(" OR ")})`,
        replacements,
      };
    };

    this.buildCursorQueryFingerprint = (
      paginationObject,
      option,
      cursorSort,
      normalizedSearchColumns
    ) =>
      crypto
        .createHash("sha256")
        .update(
          stableSerialize({
            dialect: this.dialect,
            tableName: option.tableName,
            joinQuery: option.joinQuery || "",
            search: paginationObject.search || "",
            filters: paginationObject.filters || null,
            additionalWhereConditions: option.additionalWhereConditions || null,
            searchColumnList: normalizedSearchColumns,
            cursorSort: cursorSort.map(({ alias, direction, field }) => ({
              alias,
              direction,
              field,
            })),
          })
        )
        .digest("hex");

    this.encodeCursorToken = (payload) =>
      encodeBase64Url(JSON.stringify(payload));

    this.decodeCursor = (cursorToken) => {
      if (typeof cursorToken !== "string" || cursorToken.trim() === "") {
        throw new Error("cursor token must be a non-empty string");
      }

      try {
        const decodedToken = JSON.parse(decodeBase64Url(cursorToken));

        if (
          !decodedToken ||
          typeof decodedToken !== "object" ||
          decodedToken.v !== cursorTokenVersion ||
          typeof decodedToken.d !== "string" ||
          typeof decodedToken.fp !== "string" ||
          !Array.isArray(decodedToken.s) ||
          !Array.isArray(decodedToken.values) ||
          decodedToken.dir !== "after"
        ) {
          throw new Error("Invalid cursor token");
        }

        if (decodedToken.s.length !== decodedToken.values.length) {
          throw new Error("Invalid cursor token");
        }

        return decodedToken;
      } catch (error) {
        throw new Error("Invalid cursor token");
      }
    };

    this.assertCursorTokenMatchesPlan = (decodedCursor, cursorPlan) => {
      if (decodedCursor.d !== cursorPlan.dialect) {
        throw new Error("Cursor token dialect does not match the current query");
      }

      if (decodedCursor.fp !== cursorPlan.queryFingerprint) {
        throw new Error("Cursor token does not match the current query");
      }

      const expectedSort = cursorPlan.normalizedSort.map(
        ({ attribute, direction }) => [attribute, direction]
      );

      if (stableSerialize(decodedCursor.s) !== stableSerialize(expectedSort)) {
        throw new Error("Cursor token sort does not match the current query");
      }
    };

    this.createCursorPlan = (
      paginationObject,
      cursorSort,
      queryFingerprint,
      afterToken = null
    ) => ({
      version: cursorTokenVersion,
      dialect: this.dialect,
      direction: "forward",
      requestedLimit: paginationObject.limit,
      fetchLimit: paginationObject.limit + 1,
      normalizedSort: cursorSort.map(({ alias, direction }) => ({
        attribute: alias,
        direction,
      })),
      cursorAliases: cursorSort.map(({ alias }) => alias),
      queryFingerprint,
      after: afterToken,
    });

    this.encodeCursorFromRow = (row, cursorPlan) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        throw new Error("row must be an object");
      }

      if (!cursorPlan || typeof cursorPlan !== "object") {
        throw new Error("cursorPlan must be an object");
      }

      const normalizedSort = Array.isArray(cursorPlan.normalizedSort)
        ? cursorPlan.normalizedSort
        : [];

      if (normalizedSort.length === 0) {
        throw new Error("cursorPlan.normalizedSort must be a non-empty array");
      }

      const values = normalizedSort.map(({ attribute }) => {
        const value = row[attribute];
        if (value === null || value === undefined) {
          throw new Error(
            `cursor row is missing a non-null value for "${attribute}"`
          );
        }
        return value;
      });

      return this.encodeCursorToken({
        v: cursorTokenVersion,
        d: cursorPlan.dialect,
        fp: cursorPlan.queryFingerprint,
        s: normalizedSort.map(({ attribute, direction }) => [
          attribute,
          direction,
        ]),
        values,
        dir: "after",
      });
    };

    this.resolveCursorPage = (rows, cursorPlan) => {
      if (!Array.isArray(rows)) {
        throw new Error("rows must be an array");
      }

      if (!cursorPlan || typeof cursorPlan !== "object") {
        throw new Error("cursorPlan must be an object");
      }

      const requestedLimit = cursorPlan.requestedLimit;
      if (!Number.isFinite(requestedLimit) || requestedLimit < 1) {
        throw new Error("cursorPlan.requestedLimit must be a positive number");
      }

      const hasNextPage = rows.length > requestedLimit;
      const keptRows = hasNextPage ? rows.slice(0, requestedLimit) : [...rows];
      const startCursor =
        keptRows.length > 0 ? this.encodeCursorFromRow(keptRows[0], cursorPlan) : null;
      const endCursor =
        keptRows.length > 0
          ? this.encodeCursorFromRow(keptRows[keptRows.length - 1], cursorPlan)
          : null;

      return {
        rows: keptRows,
        pageInfo: {
          hasNextPage,
          hasPreviousPage: Boolean(cursorPlan.after),
          startCursor,
          endCursor,
          nextCursor: hasNextPage ? endCursor : null,
        },
      };
    };

    this.validateCursorPaginationInput = (paginationObject, inputOptions) => {
      const result = this.createValidationResult();
      const normalizedPaginationObject =
        this.normalizeCursorPaginationObject(paginationObject);
      const normalizedOptions = this.normalizeV2Options(inputOptions);
      const cursorValidationObject = {
        search: normalizedPaginationObject.search,
        filters: normalizedPaginationObject.filters,
        sort: normalizedPaginationObject.sort,
      };

      this.mergeValidationResults(
        result,
        this.validatePaginationObject(cursorValidationObject)
      );
      this.mergeValidationResults(result, this.validateOptions(normalizedOptions));

      if (normalizedPaginationObject.before !== undefined) {
        this.addValidationIssue(
          result,
          "errors",
          'cursorPaginationObject.before is not supported; use "after" only'
        );
      }

      if (normalizedPaginationObject.after !== undefined) {
        if (
          typeof normalizedPaginationObject.after !== "string" ||
          normalizedPaginationObject.after.trim() === ""
        ) {
          this.addValidationIssue(
            result,
            "errors",
            "cursorPaginationObject.after must be a non-empty string when provided"
          );
        }
      }

      if (normalizedPaginationObject.pageNo !== undefined) {
        this.addValidationIssue(
          result,
          "errors",
          "cursorPaginationObject.pageNo is not supported in paginateCursor()"
        );
      }

      if (normalizedPaginationObject.itemsPerPage !== undefined) {
        this.addValidationIssue(
          result,
          "errors",
          "cursorPaginationObject.itemsPerPage is not supported in paginateCursor()"
        );
      }

      if (normalizedPaginationObject.offset !== undefined) {
        this.addValidationIssue(
          result,
          "errors",
          "cursorPaginationObject.offset is not supported in paginateCursor()"
        );
      }

      if (normalizedPaginationObject.limit === undefined) {
        this.addValidationIssue(
          result,
          "errors",
          "cursorPaginationObject.limit is required in paginateCursor()"
        );
      } else if (
        !Number.isInteger(normalizedPaginationObject.limit) ||
        normalizedPaginationObject.limit < 1
      ) {
        this.addValidationIssue(
          result,
          "errors",
          "cursorPaginationObject.limit must be an integer greater than or equal to 1"
        );
      }

      if (!Array.isArray(normalizedOptions) || normalizedOptions.length !== 1) {
        this.addValidationIssue(
          result,
          "errors",
          "paginateCursor() currently supports exactly one option block"
        );
      }

      if (!normalizedPaginationObject.sort) {
        this.addValidationIssue(
          result,
          "errors",
          "cursorPaginationObject.sort is required in paginateCursor()"
        );
      }

      if (result.errors.length === 0) {
        try {
          const safeOptionsObject = this.resolveSafeOptions();
          const preparedOptions = this.prepareSafeOptions(
            normalizedOptions,
            safeOptionsObject
          );
          const option = preparedOptions[0];
          const cursorSort = this.resolveCursorSortColumns(
            normalizedPaginationObject.sort,
            option
          );
          const renderedSearchColumns = this.buildSafeSearchColumns(
            option.searchColumnList || [],
            safeOptionsObject
          );
          const cursorPlan = this.createCursorPlan(
            normalizedPaginationObject,
            cursorSort,
            this.buildCursorQueryFingerprint(
              normalizedPaginationObject,
              option,
              cursorSort,
              renderedSearchColumns
            ),
            normalizedPaginationObject.after || null
          );

          if (normalizedPaginationObject.after) {
            const decodedCursor = this.decodeCursor(normalizedPaginationObject.after);
            this.assertCursorTokenMatchesPlan(decodedCursor, cursorPlan);
          }
        } catch (error) {
          this.addValidationIssue(result, "errors", error.message);
        }
      }

      result.valid = result.errors.length === 0;
      return result;
    };

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

    this.validateConditionTuple = (tuple, path, result, asItIs = false) => {
      if (tuple.length !== 3) {
        return this.addValidationIssue(
          result,
          "errors",
          `${path} must contain exactly three items`
        );
      }

      const [field, operator, value] = tuple;
      const normalizedOperator = operator?.toUpperCase?.();

      if (typeof field !== "string" || field.trim() === "") {
        this.addValidationIssue(
          result,
          "errors",
          `${path}[0] must be a non-empty string`
        );
      }

      if (typeof operator !== "string" || operator.trim() === "") {
        this.addValidationIssue(
          result,
          "errors",
          `${path}[1] must be a non-empty string`
        );
        return result;
      }

      if (
        !asItIs &&
        !this.dialectAdapter.allowedOperators.has(normalizedOperator)
      ) {
        this.addValidationIssue(
          result,
          "errors",
          `${path}[1] must be one of the supported operators for ${this.dialect}`
        );
      }

      if (
        ["IN", "NOT IN", "! IN"].includes(normalizedOperator) &&
        Array.isArray(value) &&
        value.length === 0
      ) {
        this.addValidationIssue(
          result,
          "errors",
          `${path}[2] must not be an empty array for ${normalizedOperator}`
        );
      }

      if (
        !asItIs &&
        Array.isArray(value) &&
        !this.dialectAdapter.arrayValueOperators.has(normalizedOperator)
      ) {
        this.addValidationIssue(
          result,
          "warnings",
          `${path}[2] is an array but ${normalizedOperator} is not usually used with array values`
        );
      }

      return result;
    };

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

        if (
          !asItIs &&
          (!operator || !this.dialectAdapter.allowedOperators.has(operator))
        ) {
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

    this.paginateCursor = (
      cursorPaginationObject,
      options,
      overrideSafeOptions = {}
    ) => {
      try {
        const safeOptionsObject = this.resolveSafeOptions(overrideSafeOptions);
        const normalizedPaginationObject =
          this.normalizeCursorPaginationObject(cursorPaginationObject);
        const normalizedOptions = this.normalizeV2Options(options);

        if (safeOptionsObject.validate) {
          const validationResult = this.validateCursorPaginationInput(
            normalizedPaginationObject,
            normalizedOptions
          );

          if (!validationResult.valid) {
            throw new Error(validationResult.errors.join("\n"));
          }
        }

        const preparedOptions = this.prepareSafeOptions(
          normalizedOptions,
          safeOptionsObject
        );
        const option = preparedOptions[0];
        const cursorSort = this.resolveCursorSortColumns(
          normalizedPaginationObject.sort,
          option
        );
        const renderedSearchColumns = this.buildSafeSearchColumns(
          option.searchColumnList || [],
          safeOptionsObject
        );
        const queryFingerprint = this.buildCursorQueryFingerprint(
          normalizedPaginationObject,
          option,
          cursorSort,
          renderedSearchColumns
        );
        const cursorPlan = this.createCursorPlan(
          normalizedPaginationObject,
          cursorSort,
          queryFingerprint,
          normalizedPaginationObject.after || null
        );

        let decodedCursor = null;
        if (normalizedPaginationObject.after) {
          decodedCursor = this.decodeCursor(normalizedPaginationObject.after);
          this.assertCursorTokenMatchesPlan(decodedCursor, cursorPlan);
        }

        const queryObject = this.singleTablePagination(
          option.tableName,
          normalizedPaginationObject,
          option.searchColumnList || [],
          option.joinQuery || "",
          option.columnList || [{ name: "*" }],
          option.additionalWhereConditions || []
        );

        const replacements = [...queryObject.replacements];
        let query = queryObject.query;
        let countQuery = queryObject.countQuery;
        let totalCountQuery = queryObject.totalCountQuery;

        if (decodedCursor) {
          const cursorPredicate = this.buildCursorPredicate(
            cursorSort,
            decodedCursor.values,
            decodedCursor.dir
          );

          query = this.appendConditionToQuery(query, cursorPredicate.query);
          countQuery = this.appendConditionToQuery(
            countQuery,
            cursorPredicate.query
          );
          totalCountQuery = this.appendConditionToQuery(
            totalCountQuery,
            cursorPredicate.query
          );
          replacements.push(...cursorPredicate.replacements);
        }

        const orderByQuery = this.buildOrderByQuery({
          attributes: cursorSort.map(({ alias }) => alias),
          sorts: cursorSort.map(({ direction }) => direction),
        });

        query += /\s$/.test(query) ? orderByQuery : ` ${orderByQuery}`;
        query = this.dialectAdapter.applyCursorPagination(
          query,
          cursorPlan.fetchLimit,
          replacements
        );

        return {
          countQuery,
          totalCountQuery,
          query,
          replacements,
          cursorPlan,
        };
      } catch (error) {
        throw this.toError(error);
      }
    };

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
