const PagiHelpV2 = require("../v2");

const pagiHelp = new PagiHelpV2({
  dialect: "postgres",
});

const initialQueries = pagiHelp.paginateCursor(
  {
    search: "mail",
    filters: [["stage", "=", "OPEN"]],
    sort: {
      attributes: ["createdAt"],
      sorts: ["desc"],
    },
    limit: 20,
  },
  [
    {
      tableName: "audit.licenses",
      columnList: [
        { name: "license_id", alias: "id" },
        { name: "created_at", alias: "createdAt" },
        { name: "stage", alias: "stage" },
        { name: "email", alias: "email" },
      ],
      searchColumnList: [{ name: "email" }, { name: "stage" }],
    },
  ]
);

console.log("Initial query:");
console.log(JSON.stringify(initialQueries, null, 2));

const fetchedRows = [
  {
    id: 104,
    createdAt: "2026-03-14T10:00:00.000Z",
    stage: "OPEN",
    email: "user104@example.com",
  },
  {
    id: 103,
    createdAt: "2026-03-14T09:58:00.000Z",
    stage: "OPEN",
    email: "user103@example.com",
  },
];

const resolvedPage = pagiHelp.resolveCursorPage(
  fetchedRows,
  initialQueries.cursorPlan
);

console.log("Resolved page:");
console.log(JSON.stringify(resolvedPage, null, 2));

const nextQueries = pagiHelp.paginateCursor(
  {
    filters: [["stage", "=", "OPEN"]],
    sort: {
      attributes: ["createdAt"],
      sorts: ["desc"],
    },
    limit: 20,
    after: resolvedPage.pageInfo.endCursor,
  },
  [
    {
      tableName: "audit.licenses",
      columnList: [
        { name: "license_id", alias: "id" },
        { name: "created_at", alias: "createdAt" },
        { name: "stage", alias: "stage" },
      ],
      searchColumnList: [{ name: "stage" }],
    },
  ]
);

console.log("Next-page query:");
console.log(JSON.stringify(nextQueries, null, 2));
