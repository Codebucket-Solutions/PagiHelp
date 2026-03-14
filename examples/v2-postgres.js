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
    tableName: "audit.licenses",
    columnList: [
      { name: "license_id", alias: "id" },
      { name: "created_at", alias: "createdAt" },
      { name: "stage", alias: "stage" },
      { name: "meta_info", alias: "metaInfo" },
      { name: "tags", alias: "tags" },
      {
        statement:
          "(CASE WHEN audit.licenses.assigned_to = '1' THEN 'Yes' ELSE 'No' END)",
        alias: "assignedToMe",
      },
      { name: "email", alias: "email" },
    ],
    searchColumnList: [
      { name: "email" },
      { name: "stage" },
    ],
    additionalWhereConditions: [["audit.licenses.organization_id", "=", 42]],
  },
];

const result = pagiHelp.paginate(paginationObject, options);

console.log(JSON.stringify(result, null, 2));
