const PagiHelp = require("../index");

const pagiHelp = new PagiHelp();

const paginationObject = {
  search: "campaign",
  filters: [
    ["status", "=", "Active"],
    ["created_date", ">=", "2024-01-01"],
  ],
  sort: {
    attributes: ["created_date"],
    sorts: ["desc"],
  },
  pageNo: 1,
  itemsPerPage: 10,
};

const options = [
  {
    tableName: "campaigns",
    columnList: [
      { name: "campaign_id", alias: "id" },
      { name: "campaign_name", alias: "campaign_name" },
      { name: "created_date", alias: "created_date" },
      { name: "status", alias: "status" },
    ],
    searchColumnList: [
      { name: "campaign_name" },
      { name: "status" },
    ],
  },
];

const result = pagiHelp.paginate(paginationObject, options);

console.log(JSON.stringify(result, null, 2));
