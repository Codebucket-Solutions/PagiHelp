const PagiHelp = require("../index");

const pagiHelp = new PagiHelp();

const paginationObject = {
  filters: ["status", "IN", ["Active", "Paused"]],
  sort: {
    attributes: ["created_at"],
    sorts: ["desc"],
  },
  pageNo: 1,
  itemsPerPage: 10,
};

const options = [
  {
    tableName: "events",
    columnList: [
      { name: "id", alias: "id" },
      { name: "status", alias: "status" },
      { name: "created_at", alias: "created_at" },
    ],
    searchColumnList: [],
  },
];

const report = pagiHelp.validatePaginationInput(paginationObject, options);

if (!report.valid) {
  throw new Error(report.errors.join("\n"));
}

const result = pagiHelp.paginateSafe(paginationObject, options);

console.log(JSON.stringify(result, null, 2));
