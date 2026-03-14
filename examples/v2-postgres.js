const PagiHelpV2 = require("../v2");

const pagiHelp = new PagiHelpV2({
  dialect: "postgres",
});

const paginationObject = {
  search: "mail",
  filters: [
    ["metaInfo", "@>", { priority: "high" }],
    ["tags", "?|", ["vip", "priority"]],
    ["email", "~*", "@example\\.com$"],
  ],
  sort: {
    attributes: ["createdAt"],
    sorts: ["desc"],
  },
  pageNo: 2,
  itemsPerPage: 10,
};

const options = [
  {
    tableName: "licenses",
    columnList: [
      { name: "license_id", prefix: "l", alias: "id" },
      { name: "created_at", prefix: "l", alias: "createdAt" },
      { name: "stage", prefix: "l", alias: "stage" },
      { name: "meta_info", prefix: "l", alias: "metaInfo" },
      { name: "tags", prefix: "l", alias: "tags" },
      {
        statement: "(CASE WHEN l.assigned_to = '1' THEN 'Yes' ELSE 'No' END)",
        alias: "assignedToMe",
      },
      { name: "email", prefix: "i", alias: "email" },
    ],
    searchColumnList: [
      { name: "email", prefix: "i" },
      { name: "stage", prefix: "l" },
    ],
    joinQuery:
      "l LEFT JOIN investor_registration i ON l.investor_id = i.investor_id",
    additionalWhereConditions: [["l.status", "=", "Active"]],
  },
];

const result = pagiHelp.paginate(paginationObject, options);

console.log(JSON.stringify(result, null, 2));
