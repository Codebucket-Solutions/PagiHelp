let rtrim = (str, chr) => {
  var rgxtrim = !chr ? new RegExp("\\s+$") : new RegExp(chr + "+$");
  return str.replace(rgxtrim, "");
};

let allowedOperators= ['>','>=','<','<=','=','!=','<>','IN','NOT IN','! IN','IS','IS NOT','LIKE','RLIKE','MEMBER OF','JSON_CONTAINS']
let allowedSorts = ['ASC','DESC']
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
  
    // Skip escaping if tuple[0] starts with "(" (indicating it's a statement)
    if (!asItIs && tuple[0].trim().startsWith("(")) {
      let query = `${tuple[0]}`;
      if (tuple[1] && tuple[2] !== undefined) {
          query += ` ${tuple[1]} ?`;
          replacements.push(tuple[2]);
      }
      return query;
    }

    // Escape column names only
    if (!asItIs && !tuple[0].includes(" ") && !tuple[0].includes("(")) {
      tuple[0] = SqlString.escapeId(tuple[0]);
    }
    
    if (tuple[1].toUpperCase() === 'JSON_CONTAINS') {
      const field = tuple[0].trim().startsWith('(') ? tuple[0] : this.columnNameConverter(tuple[0]);
      let query = `${tuple[1]}(${field}, ?)`;
      if (tuple[2] && typeof tuple[2] === 'object') {
        replacements.push(JSON.stringify(tuple[2]));
      } else {
        replacements.push(tuple[2]);
      }
      return query;
    } else {
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
    }
    
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
    let filters = paginationObject.filters;

    if (filters && filters.length > 0) {    
      // Function to convert snake_case to camelCase
      const toCamelCase = (str) => {
        return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      };
    
      let additionalWhereConditionsForTotalCountQuery = [];
    
      const processCondition = (condition) => {
        if (Array.isArray(condition[0])) {
          // If condition[0] is an array, process each sub-condition and group them together
          const nestedConditions = condition.map(subCondition => processCondition(subCondition).flat());
          return [nestedConditions];
        } else {
          const [field, operator, value] = condition;
  
          // Convert field to camelCase
          const camelCaseField = toCamelCase(field);
    
          // Find the column matching the alias
          const column = columnList.find(col => toCamelCase(col.alias) === camelCaseField);
    
          if (column) {
            let fieldName;
    
            if (column.statement) {
              fieldName = column.statement;
            } else if (column.prefix) {
              fieldName = `${column.prefix}.${column.name}`;
            } else {
              fieldName = column.name;
            }
    
            return [[fieldName, operator, value]];
          }
    
          return []; // Return an empty array if no column matches
          }
        };
    
        filters.forEach(condition => {
          const processedConditions = processCondition(condition);
          additionalWhereConditionsForTotalCountQuery.push(...processedConditions);
        });
    
        additionalWhereConditions = [
          ...additionalWhereConditions,
          ...additionalWhereConditionsForTotalCountQuery,
        ];
    }

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

      let totalCountQuery =
      "SELECT COUNT(*) AS countValue " +
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

    if(searchColumnList && searchColumnList.length>0) {
      whereQuery = whereQuery + "( ";
      for (let column of searchColumnList) {
      whereQuery = whereQuery + column + " LIKE ? OR ";
      replacements.push(`%${paginationObject.search}%`);
      }
      whereQuery = rtrim(whereQuery, "OR ");
      whereQuery = whereQuery + " )";
    } else {
      whereQuery = rtrim(whereQuery, "AND ");
    }
    

    query = query + whereQuery;
    countQuery = countQuery + whereQuery;
    totalCountQuery = totalCountQuery + whereQuery;
    console.log(replacements);
    return {
      query,
      countQuery,
      totalCountQuery,
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
    let totalCountQuery = "";
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
      totalCountQuery = totalCountQuery + queryObject.totalCountQuery + " UNION ALL ";
      replacements.push(...queryObject.replacements);
    }

    query = rtrim(query, "UNION ALL ");
    countQuery = rtrim(countQuery, "UNION ALL ");
    totalCountQuery = rtrim(totalCountQuery, "UNION ALL ");

    let sort = paginationObject.sort;
    if (sort && Object.keys(sort).length !== 0) {
      for(let i = 0; i < sort.sorts.length; i++) {
        if(!allowedSorts.includes(sort.sorts[i].toUpperCase())) 
            throw "INVALID SORT VALUE";
        sort.sorts[i] = sort.sorts[i].toUpperCase()
      }
      for (let i = 0; i < sort.attributes.length; i++) {
        orderByQuery =
          orderByQuery +
          "" +
          this.columnNameConverter(SqlString.escapeId(sort.attributes[i])) +
          "" +
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
    } else if(paginationObject.offset && paginationObject.limit ) {
      query = query + " LIMIT ?,?";
      replacements.push(paginationObject.offset,paginationObject.limit)
    }

    return {
      countQuery,
      totalCountQuery,
      query,
      replacements,
    };
  };
}

module.exports = PagiHelp
