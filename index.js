let rtrim = (str, chr) => {
  var rgxtrim = !chr ? new RegExp("\\s+$") : new RegExp(chr + "+$");
  return str.replace(rgxtrim, "");
};

let allowedOperators= ['>','>=','<','<=','=','!=','<>','IN','NOT IN','! IN','IS','IS NOT','LIKE','RLIKE','MEMBER OF']
let SqlString = require('sqlstring');
class PagiHelp {
  constructor(options) {
    if(options) {
        let { columnNameConverter } = options;
        if (columnNameConverter) this.columnNameConverter = columnNameConverter;
    }
  }

  columnNameConverter = (x) => x;

  columNames = (arr) =>
    arr.map((a) => {
      if (a.prefix) {
        if (a.alias)
          return (
            a.prefix + "." + this.columnNameConverter(a.name) + " AS " + a.alias
          );
        return a.prefix + "." + this.columnNameConverter(a.name);
      }
      if (a.statement) {
        if (a.alias) return a.statement + " AS " + a.alias;
        return a.statement;
      }
      if (a.alias) return this.columnNameConverter(a.name) + " AS " + a.alias;
      return this.columnNameConverter(a.name);
    });

  tupleCreator = (tuple, replacements, asItIs = false) => {
    if(!asItIs&&!allowedOperators.includes(tuple[1].toUpperCase()))
        throw "Invalid Operator"
    if(!asItIs)
        tuple[0] = SqlString.escapeId(tuple[0]);
    let query = `${this.columnNameConverter(tuple[0])} ${tuple[1]}`;
    if (asItIs) query = `${tuple[0]} ${tuple[1]}`;
    if (tuple[2] instanceof Array) {
      query += " (" + "?,".repeat(tuple[2].length).slice(0, -1) + ")";
      replacements.push(...tuple[2]);
    } else {
      query += ` ?`;
      replacements.push(tuple[2]);
    }
    return query;
  };

  genSchema = (schemaArray, replacements, asItIs = false) => {
    if (!(schemaArray[0] instanceof Array)) {
      return this.tupleCreator(schemaArray, replacements, asItIs);
    }
    let returnString = "(";
    for (let schemaObject of schemaArray) {
      if (!(schemaObject[0] instanceof Array)) {
        returnString +=
          this.tupleCreator(schemaObject, replacements, asItIs) + " AND ";
      } else {
        let subString = "( ";
        for (let subObject of schemaObject) {
          subString += this.genSchema(subObject, replacements) + " OR ";
        }
        returnString += rtrim(subString, " OR ") + ") AND ";
      }
    }
    return rtrim(returnString, " AND ") + ")";
  };

  singleTablePagination = (
    tableName,
    paginationObject,
    searchColumnList,
    joinQuery = "",
    columnList = [{ name: "*" }],
    additionalWhereConditions = []
  ) => {
    columnList = this.columNames(columnList);
    searchColumnList = this.columNames(searchColumnList);

    let query =
      "SELECT " +
      columnList.join(",") +
      " FROM `" +
      tableName +
      "`" +
      joinQuery;

    let countQuery =
      "SELECT " +
      columnList.join(",") +
      " FROM `" +
      tableName +
      "`" +
      joinQuery;

    let replacements = [];

    let whereQuery = " WHERE ";

    if (additionalWhereConditions.length > 0) {
      whereQuery =
        whereQuery +
        this.genSchema(additionalWhereConditions, replacements, true) +
        " AND ";
    }

    let havingQuery = " HAVING ";
    let havingReplacements = [];

    let filters = paginationObject.filters;

    if (filters && filters.length > 0) {
      havingQuery = havingQuery + this.genSchema(filters, havingReplacements);
    } else {
      havingQuery = "";
    }

    whereQuery = whereQuery + "( ";
    for (let column of searchColumnList) {
      whereQuery = whereQuery + column + " LIKE ? OR ";
      replacements.push(`%${paginationObject.search}%`);
    }
    whereQuery = rtrim(whereQuery, "OR ");
    whereQuery = whereQuery + " )";

    query = query + whereQuery + " " + havingQuery;
    countQuery = countQuery + whereQuery + " " + havingQuery;
    replacements.push(...havingReplacements);
    console.log(replacements);
    return {
      query,
      countQuery,
      replacements,
    };
  };

  filler = (data) => {
    let allAliases = new Set();
    for (let i = 0; i < data.length; i++) {
      data[i].columnList.sort((a, b) => a.alias - b.alias);
      for (let col of data[i].columnList) {
        allAliases.add(col.alias);
      }
    }
    allAliases = [...allAliases].sort((a, b) => a - b);
    for (let i = 0; i < data.length; i++) {
      for (let j = 0; j < allAliases.length; j++) {
        if (
          data[i]["columnList"][j] &&
          data[i]["columnList"][j].alias == allAliases[j]
        )
          continue;
        else {
          if (!data[i]["columnList"][j]) {
            data[i]["columnList"][j] = {
              statement: "(NULL)",
              alias: allAliases[j],
            };
          } else {
            data[i]["columnList"].splice(j, 0, {
              statement: "(NULL)",
              alias: allAliases[j],
            });
          }
        }
      }
    }
    return data;
  };

  paginate = (paginationObject, options) => {
    if (paginationObject.sort) {
      paginationObject.sort.attributes.push("id");
      paginationObject.sort.sorts.push("desc");
    }
    let query = "";
    let countQuery = "";
    let orderByQuery = "ORDER BY ";
    let replacements = [];
    options = this.filler(options);

    for (let option of options) {
      let queryObject = this.singleTablePagination(
        option.tableName,
        paginationObject,
        option.searchColumnList,
        option.joinQuery ? option.joinQuery : "",
        option.columnList ? option.columnList : [{ name: "*" }],
        option.additionalWhereConditions ? option.additionalWhereConditions : []
      );

      query = query + queryObject.query + " UNION ALL ";
      countQuery = countQuery + queryObject.countQuery + " UNION ALL ";
      replacements.push(...queryObject.replacements);
    }

    query = rtrim(query, "UNION ALL ");
    countQuery = rtrim(countQuery, "UNION ALL ");

    let sort = paginationObject.sort;
    if (sort && Object.keys(sort).length !== 0) {
      for (let i = 0; i < sort.attributes.length; i++) {
        orderByQuery =
          orderByQuery +
          "`" +
          this.columnNameConverter(sort.attributes[i]) +
          "` " +
          sort.sorts[i] +
          ",";
      }
      orderByQuery = rtrim(orderByQuery, ",");
      query = query + orderByQuery;
    }

    if (paginationObject.pageNo && paginationObject.itemsPerPage) {
      let offset =
        (paginationObject.pageNo - 1) * paginationObject.itemsPerPage;

      query = query + " LIMIT ?,?";
      replacements.push(offset, paginationObject.itemsPerPage);
    }

    return {
      countQuery,
      query,
      replacements,
    };
  };
}

module.exports = PagiHelp