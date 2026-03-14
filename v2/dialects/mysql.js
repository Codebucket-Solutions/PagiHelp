const SqlString = require("sqlstring");

const buildArrayPlaceholders = (values) =>
  "(" + "?,".repeat(values.length).slice(0, -1) + ")";

const isParenthesizedSql = (value) =>
  typeof value === "string" &&
  value.trim().startsWith("(") &&
  value.trim().endsWith(")");

const serializeMysqlJsonValue = (value) =>
  value && typeof value === "object" ? JSON.stringify(value) : value;

module.exports = {
  name: "mysql",

  quoteIdentifier(identifier) {
    return SqlString.escapeId(identifier);
  },

  buildBaseQueries(tableName, joinQuery, columnList, countQueryMode = "aggregate") {
    const selectColumns = columnList.join(",");
    const fromClause = ` FROM ${this.quoteIdentifier(tableName)}${joinQuery}`;
    const selectQuery = `SELECT ${selectColumns}${fromClause}`;
    const aggregateQuery = `SELECT COUNT(*) AS countValue ${fromClause}`;

    return {
      query: selectQuery,
      countQuery: countQueryMode === "aggregate" ? aggregateQuery : selectQuery,
      totalCountQuery: aggregateQuery,
    };
  },

  buildTuple(tuple, replacements, asItIs = false) {
    const operator = tuple[1]?.toUpperCase?.();
    const value = tuple[2];
    const field = tuple[0];

    if (operator === "JSON_CONTAINS" || operator === "JSON_OVERLAPS") {
      replacements.push(serializeMysqlJsonValue(value));
      return `${operator}(${field}, ?)`;
    }

    if (operator === "FIND_IN_SET") {
      replacements.push(value);
      return `FIND_IN_SET(?, ${field})`;
    }

    let query = `${field} ${asItIs ? tuple[1] : operator}`;

    if (Array.isArray(value)) {
      query += ` ${buildArrayPlaceholders(value)}`;
      replacements.push(...value);
      return query;
    }

    if (asItIs && isParenthesizedSql(value)) {
      return `${query} ${value}`;
    }

    replacements.push(value);
    return `${query} ?`;
  },

  applyPagination(query, paginationObject, replacements) {
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
  },
};
