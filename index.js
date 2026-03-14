const SqlString = require("sqlstring");

const rtrim = (str, chr) => {
  const rgxtrim = !chr ? new RegExp("\\s+$") : new RegExp(chr + "+$");
  return str.replace(rgxtrim, "");
};

const allowedOperators = [
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
];

const allowedSorts = ["ASC", "DESC"];

const toCamelCase = (str) =>
  str.replace(/_([a-zA-Z0-9])/g, (_, char) => {
    return /[a-zA-Z]/.test(char) ? char.toUpperCase() : char;
  });

class PagiHelp {
  constructor(options) {
    if (options) {
      const { columnNameConverter } = options;
      if (columnNameConverter) {
        this.columnNameConverter = columnNameConverter;
      }
    }
  }

  columnNameConverter = (x) => x;

  columNames = (arr) =>
    arr.map((column) => {
      if (column.prefix) {
        if (column.alias) {
          return (
            column.prefix +
            "." +
            this.columnNameConverter(column.name) +
            " AS " +
            column.alias
          );
        }
        return column.prefix + "." + this.columnNameConverter(column.name);
      }

      if (column.statement) {
        if (column.alias) {
          return column.statement + " AS " + column.alias;
        }
        return column.statement;
      }

      if (column.alias) {
        return this.columnNameConverter(column.name) + " AS " + column.alias;
      }

      return this.columnNameConverter(column.name);
    });

  tupleCreator = (tuple, replacements, asItIs = false) => {
    const operator = tuple[1]?.toUpperCase?.();

    if (!asItIs && (!operator || !allowedOperators.includes(operator))) {
      throw "Invalid Operator";
    }

    const field = tuple[0];

    if (operator === "JSON_CONTAINS" || operator === "JSON_OVERLAPS") {
      const query = `${operator}(${field}, ?)`;
      if (tuple[2] && typeof tuple[2] === "object") {
        replacements.push(JSON.stringify(tuple[2]));
      } else {
        replacements.push(tuple[2]);
      }
      return query;
    }

    if (operator === "FIND_IN_SET") {
      const query = `FIND_IN_SET(?, ${field})`;
      replacements.push(tuple[2]);
      return query;
    }

    let query = `${field} ${operator}`;
    if (asItIs) {
      query = `${tuple[0]} ${tuple[1]}`;
    }

    if (Array.isArray(tuple[2])) {
      query += " (" + "?,".repeat(tuple[2].length).slice(0, -1) + ")";
      replacements.push(...tuple[2]);
    } else if (
      asItIs &&
      typeof tuple[2] === "string" &&
      tuple[2].trim().startsWith("(") &&
      tuple[2].trim().endsWith(")")
    ) {
      query += " " + tuple[2];
    } else {
      query += " ?";
      replacements.push(tuple[2]);
    }

    return query;
  };

  genSchema = (schemaArray, replacements, asItIs = false) => {
    if (!(schemaArray[0] instanceof Array)) {
      return this.tupleCreator(schemaArray, replacements, asItIs);
    }

    let returnString = "(";

    for (const schemaObject of schemaArray) {
      if (!(schemaObject[0] instanceof Array)) {
        returnString +=
          this.tupleCreator(schemaObject, replacements, asItIs) + " AND ";
      } else {
        let subString = "( ";
        for (const subObject of schemaObject) {
          subString += this.genSchema(subObject, replacements, asItIs) + " OR ";
        }
        returnString += rtrim(subString, " OR ") + ") AND ";
      }
    }

    return rtrim(returnString, " AND ") + ")";
  };

  normalizeFilters = (filters) => {
    if (filters && filters.length > 0 && !Array.isArray(filters[0])) {
      return [filters];
    }
    return filters;
  };

  findColumnForFilter = (field, columnList) => {
    let column = columnList.find((candidate) => candidate.alias === field);

    if (!column) {
      const camelCaseField = toCamelCase(field);
      column = columnList.find(
        (candidate) => toCamelCase(candidate.alias) === camelCaseField
      );
    }

    if (!column && field.includes(".")) {
      const [prefix, colName] = field.split(".");
      column = columnList.find(
        (candidate) => candidate.prefix === prefix && candidate.name === colName
      );
    }

    return column;
  };

  getFilterFieldName = (column) => {
    if (column.statement) {
      return column.statement;
    }

    if (column.prefix) {
      return `${column.prefix}.${column.name}`;
    }

    return column.name;
  };

  processFilterCondition = (condition, columnList) => {
    if (Array.isArray(condition[0])) {
      const nestedConditions = condition.map((subCondition) =>
        this.processFilterCondition(subCondition, columnList).flat()
      );
      return [nestedConditions];
    }

    const [field, operator, value] = condition;
    const column = this.findColumnForFilter(field, columnList);

    if (!column) {
      throw `Invalid filter field: ${field}`;
    }

    return [[this.getFilterFieldName(column), operator, value]];
  };

  collectFilterConditions = (filters, columnList) => {
    const filterConditions = [];

    if (!filters || filters.length === 0) {
      return filterConditions;
    }

    filters.forEach((condition) => {
      const processedConditions = this.processFilterCondition(
        condition,
        columnList
      );
      filterConditions.push(...processedConditions);
    });

    return filterConditions;
  };

  buildSingleTableBaseQueries = (tableName, joinQuery, columnList) => {
    const selectColumns = columnList.join(",");
    const fromClause = " FROM `" + tableName + "`" + joinQuery;

    return {
      query: "SELECT " + selectColumns + fromClause,
      countQuery: "SELECT " + selectColumns + fromClause,
      totalCountQuery: "SELECT COUNT(*) AS countValue " + fromClause,
    };
  };

  buildWhereQuery = (
    paginationObject,
    searchColumnList,
    filterConditions,
    additionalWhereConditions,
    replacements
  ) => {
    let whereQuery = " WHERE ";

    if (additionalWhereConditions.length > 0) {
      whereQuery +=
        this.genSchema(additionalWhereConditions, replacements, true) + " AND ";
    }

    if (filterConditions.length > 0) {
      whereQuery +=
        this.genSchema(filterConditions, replacements, false) + " AND ";
    }

    if (
      searchColumnList &&
      searchColumnList.length > 0 &&
      paginationObject.search !== ""
    ) {
      whereQuery += "( ";
      for (const column of searchColumnList) {
        whereQuery += column + " LIKE ? OR ";
        replacements.push(`%${paginationObject.search}%`);
      }
      whereQuery = rtrim(whereQuery, "OR ");
      whereQuery += " )";
    } else {
      whereQuery = rtrim(whereQuery, "AND ");
    }

    return whereQuery;
  };

  singleTablePagination = (
    tableName,
    paginationObject,
    searchColumnList,
    joinQuery = "",
    columnList = [{ name: "*" }],
    additionalWhereConditions = []
  ) => {
    const filters = this.normalizeFilters(paginationObject.filters);
    const filterConditions = this.collectFilterConditions(filters, columnList);
    const renderedColumns = this.columNames(columnList);
    const renderedSearchColumns = this.columNames(searchColumnList);
    const { query, countQuery, totalCountQuery } =
      this.buildSingleTableBaseQueries(tableName, joinQuery, renderedColumns);

    const replacements = [];
    const whereQuery = this.buildWhereQuery(
      paginationObject,
      renderedSearchColumns,
      filterConditions,
      additionalWhereConditions,
      replacements
    );

    const queryWithWhere = query + whereQuery;
    const countQueryWithWhere = countQuery + whereQuery;
    const totalCountQueryWithWhere = totalCountQuery + whereQuery;

    console.log(replacements);

    return {
      query: queryWithWhere,
      countQuery: countQueryWithWhere,
      totalCountQuery: totalCountQueryWithWhere,
      replacements,
    };
  };

  filler = (data) => {
    let allAliases = new Set();

    for (let i = 0; i < data.length; i++) {
      data[i].columnList.sort((a, b) => a.alias - b.alias);
      for (const col of data[i].columnList) {
        allAliases.add(col.alias);
      }
    }

    allAliases = [...allAliases].sort((a, b) => a - b);

    for (let i = 0; i < data.length; i++) {
      for (let j = 0; j < allAliases.length; j++) {
        if (
          data[i].columnList[j] &&
          data[i].columnList[j].alias == allAliases[j]
        ) {
          continue;
        }

        if (!data[i].columnList[j]) {
          data[i].columnList[j] = {
            statement: "(NULL)",
            alias: allAliases[j],
          };
        } else {
          data[i].columnList.splice(j, 0, {
            statement: "(NULL)",
            alias: allAliases[j],
          });
        }
      }
    }

    return data;
  };

  buildOrderByQuery = (sort) => {
    let orderByQuery = "ORDER BY ";

    for (let i = 0; i < sort.sorts.length; i++) {
      if (!allowedSorts.includes(sort.sorts[i].toUpperCase())) {
        throw "INVALID SORT VALUE";
      }
      sort.sorts[i] = sort.sorts[i].toUpperCase();
    }

    for (let i = 0; i < sort.attributes.length; i++) {
      orderByQuery +=
        this.columnNameConverter(SqlString.escapeId(sort.attributes[i])) +
        sort.sorts[i] +
        ",";
    }

    return rtrim(orderByQuery, ",");
  };

  stripTrailingUnionAll = (query) =>
    query.trim().replace(/(UNION ALL\s*)$/i, "");

  buildTotalCountQuery = (totalCountQueries) => {
    if (totalCountQueries.length > 1) {
      return `SELECT SUM(countValue) AS countValue FROM ( ${totalCountQueries.join(
        " UNION ALL "
      )} ) AS totalCounts`;
    }

    return totalCountQueries[0];
  };

  applyPagination = (query, paginationObject, replacements) => {
    if (paginationObject.pageNo && paginationObject.itemsPerPage) {
      const offset =
        (paginationObject.pageNo - 1) * paginationObject.itemsPerPage;

      query += " LIMIT ?,?";
      replacements.push(offset, paginationObject.itemsPerPage);
    } else if (paginationObject.offset && paginationObject.limit) {
      query += " LIMIT ?,?";
      replacements.push(paginationObject.offset, paginationObject.limit);
    }

    return query;
  };

  paginate = (paginationObject, options) => {
    if (paginationObject.sort) {
      paginationObject.sort.attributes.push("id");
      paginationObject.sort.sorts.push("desc");
    }

    let query = "";
    let countQuery = "";
    let totalCountQuery = "";
    const replacements = [];
    const totalCountQueries = [];

    options = this.filler(options);

    for (const option of options) {
      const queryObject = this.singleTablePagination(
        option.tableName,
        paginationObject,
        option.searchColumnList,
        option.joinQuery ? option.joinQuery : "",
        option.columnList ? option.columnList : [{ name: "*" }],
        option.additionalWhereConditions ? option.additionalWhereConditions : []
      );

      query += queryObject.query + " UNION ALL ";
      countQuery += queryObject.countQuery + " UNION ALL ";
      totalCountQueries.push(queryObject.totalCountQuery);
      replacements.push(...queryObject.replacements);
    }

    query = this.stripTrailingUnionAll(query);
    countQuery = this.stripTrailingUnionAll(countQuery);
    totalCountQuery = this.buildTotalCountQuery(totalCountQueries);

    if (paginationObject.sort && Object.keys(paginationObject.sort).length !== 0) {
      query += this.buildOrderByQuery(paginationObject.sort);
    }

    query = this.applyPagination(query, paginationObject, replacements);

    return {
      countQuery,
      totalCountQuery,
      query,
      replacements,
    };
  };
}

module.exports = PagiHelp;
