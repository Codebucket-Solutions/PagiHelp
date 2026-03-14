const PagiHelp = require("../index");

const pagiHelp = new PagiHelp({
  columnNameConverter: (name) =>
    name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
});

const paginationObject = {
  search: "mail",
  filters: [
    ["assigned_to_me", "=", "Yes"],
    ["l.stage", "IN", ["NEW", "PROCESSING"]],
  ],
  sort: {
    attributes: ["createdDate"],
    sorts: ["desc"],
  },
  pageNo: 1,
  itemsPerPage: 20,
};

const options = [
  {
    tableName: "licenses",
    columnList: [
      { name: "license_id", prefix: "l", alias: "id" },
      { name: "created_date", prefix: "l", alias: "createdDate" },
      { name: "stage", prefix: "l", alias: "stage" },
      {
        statement: '(SELECT IF(l.assigned_to="1","Yes","No"))',
        alias: "assignedToMe",
      },
      { name: "email", prefix: "i", alias: "email" },
    ],
    searchColumnList: [
      { name: "email", prefix: "i" },
      { name: "stage", prefix: "l" },
    ],
    joinQuery:
      " l left join investor_registration i on l.investor_id = i.investor_id ",
    additionalWhereConditions: [["l.status", "=", "Active"]],
  },
];

const result = pagiHelp.paginate(paginationObject, options);

console.log(JSON.stringify(result, null, 2));
