const PagiHelpV2 = require("../v2");

const pagiHelp = new PagiHelpV2({
  dialect: "mysql",
});

const paginationObject = {
  search: "Active",
  filters: [["status", "IN", ["Active", "Paused"]]],
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
    searchColumnList: [{ name: "status" }],
  },
];

const result = pagiHelp.paginate(paginationObject, options);

console.log(JSON.stringify(result, null, 2));
