const PagiHelp = require("../index");

const pagiHelp = new PagiHelp();

const paginationObject = {
  search: "",
  sort: {
    attributes: ["id"],
    sorts: ["asc"],
  },
  offset: 10,
  limit: 20,
};

const options = [
  {
    tableName: "campaigns",
    columnList: [
      { name: "campaign_id", alias: "id" },
      { name: "campaign_name", alias: "name" },
    ],
    searchColumnList: [{ name: "campaign_name" }],
    additionalWhereConditions: [["status", "=", "Active"]],
  },
  {
    tableName: "licenses",
    columnList: [{ name: "license_id", alias: "id" }],
    searchColumnList: [],
    additionalWhereConditions: [["status", "=", "Active"]],
  },
];

const result = pagiHelp.paginate(paginationObject, options);

console.log(JSON.stringify(result, null, 2));
