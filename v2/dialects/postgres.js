const quoteIdentifier = (identifier) =>
  identifier
    .split(".")
    .map((segment) => `"${String(segment).replace(/"/g, '""')}"`)
    .join(".");

const buildArrayPlaceholders = (values) =>
  "(" + "?,".repeat(values.length).slice(0, -1) + ")";

const isParenthesizedSql = (value) =>
  typeof value === "string" &&
  value.trim().startsWith("(") &&
  value.trim().endsWith(")");

const jsonLiteralPattern = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

const isJsonLiteralString = (value) => {
  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();
  if (trimmed === "") {
    return false;
  }

  if (["null", "true", "false"].includes(trimmed)) {
    return true;
  }

  if (jsonLiteralPattern.test(trimmed)) {
    return true;
  }

  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  return (
    (first === "{" && last === "}") ||
    (first === "[" && last === "]") ||
    (first === '"' && last === '"')
  );
};

const serializePostgresJsonValue = (value) => {
  if (typeof value === "string") {
    return isJsonLiteralString(value) ? value : JSON.stringify(value);
  }

  if (value === undefined) {
    return "null";
  }

  return JSON.stringify(value);
};

const pushRepeatedValue = (replacements, value, count) => {
  for (let index = 0; index < count; index += 1) {
    replacements.push(value);
  }
};

const buildArrayLiteralPlaceholders = (values) =>
  `ARRAY[${"?,"
    .repeat(values.length)
    .slice(0, -1)}]`;

const normalizeStringArray = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }

  return [String(value)];
};

module.exports = {
  name: "postgres",
  allowedOperators: new Set([
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
    "ILIKE",
    "~",
    "~*",
    "!~",
    "!~*",
    "@>",
    "<@",
    "?",
    "?|",
    "?&",
    "&&",
    "RLIKE",
    "MEMBER OF",
    "JSON_CONTAINS",
    "JSON_OVERLAPS",
    "FIND_IN_SET",
  ]),
  arrayValueOperators: new Set([
    "IN",
    "NOT IN",
    "! IN",
    "@>",
    "<@",
    "?|",
    "?&",
    "&&",
    "JSON_CONTAINS",
    "JSON_OVERLAPS",
    "MEMBER OF",
  ]),

  quoteIdentifier,

  buildBaseQueries(tableName, joinQuery, columnList, countQueryMode = "aggregate") {
    const selectColumns = columnList.join(",");
    const fromClause = ` FROM ${quoteIdentifier(tableName)}${joinQuery}`;
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
    const rawOperator = tuple[1];
    const value = tuple[2];
    const field = tuple[0];

    if (asItIs) {
      let rawQuery = `${field} ${rawOperator}`;

      if (Array.isArray(value)) {
        rawQuery += ` ${buildArrayPlaceholders(value)}`;
        replacements.push(...value);
        return rawQuery;
      }

      if (isParenthesizedSql(value)) {
        return `${rawQuery} ${value}`;
      }

      replacements.push(value);
      return `${rawQuery} ?`;
    }

    if (operator === "JSON_CONTAINS") {
      replacements.push(serializePostgresJsonValue(value));
      return `(${field})::jsonb @> (?::jsonb)`;
    }

    if (operator === "@>") {
      replacements.push(serializePostgresJsonValue(value));
      return `(${field})::jsonb @> (?::jsonb)`;
    }

    if (operator === "<@") {
      replacements.push(serializePostgresJsonValue(value));
      return `(${field})::jsonb <@ (?::jsonb)`;
    }

    if (operator === "JSON_OVERLAPS") {
      const serializedValue = serializePostgresJsonValue(value);
      pushRepeatedValue(replacements, serializedValue, 8);

      return (
        `(CASE ` +
        `WHEN jsonb_typeof((${field})::jsonb) = 'array' AND jsonb_typeof(?::jsonb) = 'array' THEN EXISTS (` +
        `SELECT 1 FROM jsonb_array_elements((${field})::jsonb) AS left_values(value) ` +
        `INNER JOIN jsonb_array_elements(?::jsonb) AS right_values(value) ON left_values.value = right_values.value` +
        `) ` +
        `WHEN jsonb_typeof((${field})::jsonb) = 'object' AND jsonb_typeof(?::jsonb) = 'object' THEN EXISTS (` +
        `SELECT 1 FROM jsonb_each((${field})::jsonb) AS left_pairs(key, value) ` +
        `INNER JOIN jsonb_each(?::jsonb) AS right_pairs(key, value) ON left_pairs.key = right_pairs.key AND left_pairs.value = right_pairs.value` +
        `) ` +
        `WHEN jsonb_typeof((${field})::jsonb) = 'array' THEN ((${field})::jsonb @> ?::jsonb) ` +
        `WHEN jsonb_typeof(?::jsonb) = 'array' THEN (?::jsonb @> (${field})::jsonb) ` +
        `ELSE ((${field})::jsonb = ?::jsonb) END)`
      );
    }

    if (operator === "FIND_IN_SET") {
      replacements.push(value);
      return `array_position(string_to_array(COALESCE(${field}::text, ''), ','), ?::text) IS NOT NULL`;
    }

    if (operator === "MEMBER OF") {
      replacements.push(serializePostgresJsonValue(value));
      return `(?::jsonb @> to_jsonb(${field}))`;
    }

    if (operator === "?") {
      replacements.push(String(value));
      return `(${field})::jsonb ? ?::text`;
    }

    if (operator === "?|" || operator === "?&") {
      const values = normalizeStringArray(value);
      replacements.push(...values);
      return `(${field})::jsonb ${operator} ${buildArrayLiteralPlaceholders(
        values
      )}`;
    }

    if (operator === "&&") {
      const values = Array.isArray(value) ? value : [value];
      replacements.push(...values);
      return `${field} && ${buildArrayLiteralPlaceholders(values)}`;
    }

    if (operator === "IS") {
      if (value === null) {
        return `${field} IS NULL`;
      }

      replacements.push(value);
      return `${field} IS NOT DISTINCT FROM ?`;
    }

    if (operator === "IS NOT") {
      if (value === null) {
        return `${field} IS NOT NULL`;
      }

      replacements.push(value);
      return `${field} IS DISTINCT FROM ?`;
    }

    const renderedOperator =
      operator === "! IN" ? "NOT IN" : operator === "RLIKE" ? "~" : operator;

    let query = `${field} ${renderedOperator}`;

    if (Array.isArray(value)) {
      query += ` ${buildArrayPlaceholders(value)}`;
      replacements.push(...value);
      return query;
    }

    replacements.push(value);
    return `${query} ?`;
  },

  applyPagination(query, paginationObject, replacements) {
    if (paginationObject.pageNo && paginationObject.itemsPerPage) {
      const offset =
        (paginationObject.pageNo - 1) * paginationObject.itemsPerPage;

      query += " LIMIT ? OFFSET ?";
      replacements.push(paginationObject.itemsPerPage, offset);
    } else if (paginationObject.offset && paginationObject.limit) {
      query += " LIMIT ? OFFSET ?";
      replacements.push(paginationObject.limit, paginationObject.offset);
    }

    return query;
  },

  applyCursorPagination(query, fetchLimit, replacements) {
    query += " LIMIT ? OFFSET ?";
    replacements.push(fetchLimit, 0);
    return query;
  },
};
