const assert = require("assert/strict");

const PagiHelp = require("../index");

const clone = (value) => JSON.parse(JSON.stringify(value));

const runQuietly = (fn) => {
  const originalLog = console.log;
  console.log = () => {};
  try {
    return fn();
  } finally {
    console.log = originalLog;
  }
};

const captureLogs = (fn) => {
  const originalLog = console.log;
  const logs = [];
  console.log = (...args) => {
    logs.push(args);
  };
  try {
    return { result: fn(), logs };
  } finally {
    console.log = originalLog;
  }
};

const expectThrowString = (fn, expected) => {
  let thrown;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }
  assert.equal(thrown, expected);
};

const tests = [];

const test = (name, fn) => {
  tests.push({ name, fn });
};

test("basic single-table pagination matches current SQL output", () => {
  const pagiHelp = new PagiHelp();
  const paginationObject = {
    search: "xyz",
    sort: {
      attributes: ["created_date"],
      sorts: ["asc"],
    },
    filters: [
      ["from_date", "=", "2022-05-05"],
      [
        ["campaign_description", "=", "abc"],
        ["to_date", "=", "2022-06-05"],
      ],
    ],
    pageNo: 1,
    itemsPerPage: 2,
  };
  const options = [
    {
      tableName: "campaigns",
      columnList: [
        { name: "campaign_id", alias: "id" },
        { name: "campaign_name", alias: "campaign_name" },
        { name: "campaign_description", alias: "campaign_description" },
        { name: "from_date", alias: "from_date" },
        { name: "to_date", alias: "to_date" },
        { name: "created_date", alias: "created_date" },
        { name: "updated_date", alias: "updated_date" },
      ],
      additionalWhereConditions: [["status", "=", "Active"]],
      searchColumnList: [
        { name: "campaign_name" },
        { name: "campaign_description" },
        { name: "from_date" },
        { name: "to_date" },
        { name: "created_date" },
        { name: "updated_date" },
      ],
    },
  ];

  const result = runQuietly(() =>
    pagiHelp.paginate(clone(paginationObject), clone(options))
  );

  assert.deepStrictEqual(result, {
    countQuery:
      "SELECT campaign_id AS id,campaign_name AS campaign_name,campaign_description AS campaign_description,from_date AS from_date,to_date AS to_date,created_date AS created_date,updated_date AS updated_date FROM `campaigns` WHERE (status = ?) AND (from_date = ? AND ( campaign_description = ? OR to_date = ?)) AND ( campaign_name LIKE ? OR campaign_description LIKE ? OR from_date LIKE ? OR to_date LIKE ? OR created_date LIKE ? OR updated_date LIKE ?  ) ",
    totalCountQuery:
      "SELECT COUNT(*) AS countValue  FROM `campaigns` WHERE (status = ?) AND (from_date = ? AND ( campaign_description = ? OR to_date = ?)) AND ( campaign_name LIKE ? OR campaign_description LIKE ? OR from_date LIKE ? OR to_date LIKE ? OR created_date LIKE ? OR updated_date LIKE ?  )",
    query:
      "SELECT campaign_id AS id,campaign_name AS campaign_name,campaign_description AS campaign_description,from_date AS from_date,to_date AS to_date,created_date AS created_date,updated_date AS updated_date FROM `campaigns` WHERE (status = ?) AND (from_date = ? AND ( campaign_description = ? OR to_date = ?)) AND ( campaign_name LIKE ? OR campaign_description LIKE ? OR from_date LIKE ? OR to_date LIKE ? OR created_date LIKE ? OR updated_date LIKE ?  ) ORDER BY `created_date`ASC,`id`DESC LIMIT ?,?",
    replacements: [
      "Active",
      "2022-05-05",
      "abc",
      "2022-06-05",
      "%xyz%",
      "%xyz%",
      "%xyz%",
      "%xyz%",
      "%xyz%",
      "%xyz%",
      0,
      2,
    ],
  });
});

test("filler keeps numeric-like aliases in numeric order when aligning union columns", () => {
  const pagiHelp = new PagiHelp();
  const result = pagiHelp.filler([
    {
      columnList: [{ name: "ten_col", alias: "10" }],
    },
    {
      columnList: [{ name: "two_col", alias: "2" }],
    },
  ]);

  assert.deepStrictEqual(result, [
    {
      columnList: [
        { statement: "(NULL)", alias: "2" },
        { name: "ten_col", alias: "10" },
      ],
    },
    {
      columnList: [
        { name: "two_col", alias: "2" },
        { statement: "(NULL)", alias: "10" },
      ],
    },
  ]);
});

test("filters resolve camelCase aliases and special operators keep current SQL shape", () => {
  const pagiHelp = new PagiHelp({
    columnNameConverter: (name) =>
      name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
  });
  const paginationObject = {
    search: "mail",
    sort: {
      attributes: ["createdDate"],
      sorts: ["desc"],
    },
    filters: [
      ["assigned_to_me", "=", "Yes"],
      ["l.stage", "in", ["NEW", "PROCESSING"]],
      ["meta_info", "json_contains", { a: 1 }],
      ["tags", "find_in_set", "vip"],
    ],
    pageNo: 2,
    itemsPerPage: 5,
  };
  const options = [
    {
      tableName: "licenses",
      columnList: [
        { name: "license_id", prefix: "l", alias: "id" },
        { name: "created_date", prefix: "l", alias: "createdDate" },
        { name: "stage", prefix: "l", alias: "stage" },
        { name: "meta_info", prefix: "l", alias: "metaInfo" },
        { name: "tags", prefix: "l", alias: "tags" },
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

  const result = runQuietly(() =>
    pagiHelp.paginate(clone(paginationObject), clone(options))
  );

  assert.deepStrictEqual(result, {
    countQuery:
      'SELECT l.license_id AS id,l.created_date AS createdDate,l.stage AS stage,l.meta_info AS metaInfo,l.tags AS tags,(SELECT IF(l.assigned_to="1","Yes","No")) AS assignedToMe,i.email AS email FROM `licenses` l left join investor_registration i on l.investor_id = i.investor_id  WHERE (l.status = ?) AND ((SELECT IF(l.assigned_to="1","Yes","No")) = ? AND l.stage IN (?,?) AND JSON_CONTAINS(l.meta_info, ?) AND FIND_IN_SET(?, l.tags)) AND ( i.email LIKE ? OR l.stage LIKE ?  ) ',
    totalCountQuery:
      'SELECT COUNT(*) AS countValue  FROM `licenses` l left join investor_registration i on l.investor_id = i.investor_id  WHERE (l.status = ?) AND ((SELECT IF(l.assigned_to="1","Yes","No")) = ? AND l.stage IN (?,?) AND JSON_CONTAINS(l.meta_info, ?) AND FIND_IN_SET(?, l.tags)) AND ( i.email LIKE ? OR l.stage LIKE ?  )',
    query:
      'SELECT l.license_id AS id,l.created_date AS createdDate,l.stage AS stage,l.meta_info AS metaInfo,l.tags AS tags,(SELECT IF(l.assigned_to="1","Yes","No")) AS assignedToMe,i.email AS email FROM `licenses` l left join investor_registration i on l.investor_id = i.investor_id  WHERE (l.status = ?) AND ((SELECT IF(l.assigned_to="1","Yes","No")) = ? AND l.stage IN (?,?) AND JSON_CONTAINS(l.meta_info, ?) AND FIND_IN_SET(?, l.tags)) AND ( i.email LIKE ? OR l.stage LIKE ?  ) ORDER BY `created_date`DESC,`id`DESC LIMIT ?,?',
    replacements: [
      "Active",
      "Yes",
      "NEW",
      "PROCESSING",
      '{"a":1}',
      "vip",
      "%mail%",
      "%mail%",
      5,
      5,
    ],
  });
});

test("searchColumnList supports raw statement expressions without aliases", () => {
  const pagiHelp = new PagiHelp();
  const paginationObject = {
    search: "BGL",
  };
  const options = [
    {
      tableName: "support_raise_complain",
      columnList: [
        { name: "id", alias: "id" },
        {
          statement:
            "(SELECT category_name FROM support_category WHERE id = support_raise_complain.category_id and status != 'Deleted')",
          alias: "category",
        },
      ],
      searchColumnList: [
        { name: "tracking_id" },
        {
          statement:
            "(SELECT category_name FROM support_category WHERE id = support_raise_complain.category_id and status != 'Deleted')",
        },
      ],
      additionalWhereConditions: [["status", "!=", "Deleted"]],
    },
  ];

  const result = runQuietly(() =>
    pagiHelp.paginate(clone(paginationObject), clone(options))
  );

  assert.deepStrictEqual(result, {
    countQuery:
      "SELECT id AS id,(SELECT category_name FROM support_category WHERE id = support_raise_complain.category_id and status != 'Deleted') AS category FROM `support_raise_complain` WHERE (status != ?) AND ( tracking_id LIKE ? OR (SELECT category_name FROM support_category WHERE id = support_raise_complain.category_id and status != 'Deleted') LIKE ?  ) ",
    totalCountQuery:
      "SELECT COUNT(*) AS countValue  FROM `support_raise_complain` WHERE (status != ?) AND ( tracking_id LIKE ? OR (SELECT category_name FROM support_category WHERE id = support_raise_complain.category_id and status != 'Deleted') LIKE ?  )",
    query:
      "SELECT id AS id,(SELECT category_name FROM support_category WHERE id = support_raise_complain.category_id and status != 'Deleted') AS category FROM `support_raise_complain` WHERE (status != ?) AND ( tracking_id LIKE ? OR (SELECT category_name FROM support_category WHERE id = support_raise_complain.category_id and status != 'Deleted') LIKE ?  ) ",
    replacements: ["Deleted", "%BGL%", "%BGL%"],
  });
});

test("columNames renders plain, prefixed, and statement descriptors with current conversion behavior", () => {
  const pagiHelp = new PagiHelp({
    columnNameConverter: (name) =>
      name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
  });

  const result = pagiHelp.columNames([
    { name: "plainField", alias: "plainField" },
    { name: "createdDate", prefix: "l", alias: "createdDate" },
    { statement: "COUNT(*)", alias: "countValue" },
    { statement: "NOW()" },
  ]);

  assert.deepStrictEqual(result, [
    "plain_field AS plainField",
    "l.created_date AS createdDate",
    "COUNT(*) AS countValue",
    "NOW()",
  ]);
});

test("tupleCreator preserves current validated and raw tuple behavior", () => {
  const pagiHelp = new PagiHelp();

  const arrayReplacements = [];
  const arrayQuery = pagiHelp.tupleCreator(
    ["status", "IN", ["Active", "Paused"]],
    arrayReplacements
  );

  const rawReplacements = [];
  const rawQuery = pagiHelp.tupleCreator(
    ["status", "IN", "(SELECT status FROM live_statuses)"],
    rawReplacements,
    true
  );

  assert.equal(arrayQuery, "status IN (?,?)");
  assert.deepStrictEqual(arrayReplacements, ["Active", "Paused"]);
  assert.equal(rawQuery, "status IN (SELECT status FROM live_statuses)");
  assert.deepStrictEqual(rawReplacements, []);
});

test("genSchema preserves current nested AND and OR grouping", () => {
  const pagiHelp = new PagiHelp();
  const replacements = [];
  const result = pagiHelp.genSchema(
    [
      ["status", "=", "Active"],
      [
        ["stage", "=", "NEW"],
        ["stage", "=", "PROCESSING"],
      ],
      ["created_at", ">=", "2024-01-01"],
    ],
    replacements
  );

  assert.equal(
    result,
    "(status = ? AND ( stage = ? OR stage = ?) AND created_at >= ?)"
  );
  assert.deepStrictEqual(replacements, [
    "Active",
    "NEW",
    "PROCESSING",
    "2024-01-01",
  ]);
});

test("singleTablePagination keeps joinQuery verbatim and logs replacements once", () => {
  const pagiHelp = new PagiHelp();
  const paginationObject = {
    search: "group",
  };
  const searchColumnList = [{ name: "xg.group_name" }];
  const columnList = [
    { name: "id", alias: "id", prefix: "xg" },
    { name: "group_name", alias: "groupName", prefix: "xg" },
  ];

  const { result, logs } = captureLogs(() =>
    pagiHelp.singleTablePagination(
      "xcommunity_groups",
      paginationObject,
      searchColumnList,
      "xg",
      columnList,
      [["xg.status", "=", "Active"]]
    )
  );

  assert.deepStrictEqual(result, {
    countQuery:
      "SELECT xg.id AS id,xg.group_name AS groupName FROM `xcommunity_groups`xg WHERE (xg.status = ?) AND ( xg.group_name LIKE ?  )",
    totalCountQuery:
      "SELECT COUNT(*) AS countValue  FROM `xcommunity_groups`xg WHERE (xg.status = ?) AND ( xg.group_name LIKE ?  )",
    query:
      "SELECT xg.id AS id,xg.group_name AS groupName FROM `xcommunity_groups`xg WHERE (xg.status = ?) AND ( xg.group_name LIKE ?  )",
    replacements: ["Active", "%group%"],
  });
  assert.deepStrictEqual(logs, [[["Active", "%group%"]]]);
});

test("searchColumnList supports raw dotted field names without prefix objects", () => {
  const pagiHelp = new PagiHelp();
  const paginationObject = {
    search: "group",
    pageNo: 1,
    itemsPerPage: 20,
  };
  const options = [
    {
      tableName: "xcommunity_groups",
      columnList: [
        { name: "id", alias: "id", prefix: "xg" },
        { name: "group_name", alias: "groupName", prefix: "xg" },
      ],
      additionalWhereConditions: [["xg.status", "=", "Active"]],
      searchColumnList: [{ name: "xg.group_name" }],
      joinQuery: "xg",
    },
  ];

  const result = runQuietly(() =>
    pagiHelp.paginate(clone(paginationObject), clone(options))
  );

  assert.deepStrictEqual(result, {
    countQuery:
      "SELECT xg.id AS id,xg.group_name AS groupName FROM `xcommunity_groups`xg WHERE (xg.status = ?) AND ( xg.group_name LIKE ?  ) ",
    totalCountQuery:
      "SELECT COUNT(*) AS countValue  FROM `xcommunity_groups`xg WHERE (xg.status = ?) AND ( xg.group_name LIKE ?  )",
    query:
      "SELECT xg.id AS id,xg.group_name AS groupName FROM `xcommunity_groups`xg WHERE (xg.status = ?) AND ( xg.group_name LIKE ?  )  LIMIT ?,?",
    replacements: ["Active", "%group%", 0, 20],
  });
});

test("single filter tuples are normalized into array form", () => {
  const pagiHelp = new PagiHelp();
  const paginationObject = {
    search: "",
    filters: ["created_at", ">=", "2024-01-01"],
  };
  const options = [
    {
      tableName: "events",
      columnList: [
        { name: "id", alias: "id" },
        { name: "created_at", alias: "created_at" },
      ],
      searchColumnList: [],
    },
  ];

  const result = runQuietly(() =>
    pagiHelp.paginate(clone(paginationObject), clone(options))
  );

  assert.deepStrictEqual(result, {
    countQuery:
      "SELECT id AS id,created_at AS created_at FROM `events` WHERE (created_at >= ?)  ",
    totalCountQuery:
      "SELECT COUNT(*) AS countValue  FROM `events` WHERE (created_at >= ?) ",
    query:
      "SELECT id AS id,created_at AS created_at FROM `events` WHERE (created_at >= ?)  ",
    replacements: ["2024-01-01"],
  });
});

test("json_contains accepts pre-stringified JSON strings without double encoding", () => {
  const pagiHelp = new PagiHelp({
    columnNameConverter: (name) =>
      name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
  });
  const paginationObject = {
    search: "",
    filters: ["trainingNameId", "JSON_CONTAINS", "[12]"],
  };
  const options = [
    {
      tableName: "communication_announcement",
      columnList: [
        { name: "id", alias: "id", prefix: "ca" },
        { name: "training_name_id", alias: "trainingNameId", prefix: "ca" },
      ],
      searchColumnList: [],
      joinQuery: " ca",
    },
  ];

  const result = runQuietly(() =>
    pagiHelp.paginate(clone(paginationObject), clone(options))
  );

  assert.deepStrictEqual(result, {
    countQuery:
      "SELECT ca.id AS id,ca.training_name_id AS trainingNameId FROM `communication_announcement` ca WHERE (JSON_CONTAINS(ca.training_name_id, ?))  ",
    totalCountQuery:
      "SELECT COUNT(*) AS countValue  FROM `communication_announcement` ca WHERE (JSON_CONTAINS(ca.training_name_id, ?)) ",
    query:
      "SELECT ca.id AS id,ca.training_name_id AS trainingNameId FROM `communication_announcement` ca WHERE (JSON_CONTAINS(ca.training_name_id, ?))  ",
    replacements: ["[12]"],
  });
});

test("multi-table mode pads missing aliases and aggregates total counts", () => {
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
      tableName: "a",
      columnList: [
        { name: "id", alias: "id" },
        { name: "name", alias: "name" },
      ],
      searchColumnList: [{ name: "name" }],
      additionalWhereConditions: [["status", "=", "Active"]],
    },
    {
      tableName: "b",
      columnList: [{ name: "id", alias: "id" }],
      searchColumnList: [],
      additionalWhereConditions: [["status", "=", "Active"]],
    },
  ];

  const result = runQuietly(() =>
    pagiHelp.paginate(clone(paginationObject), clone(options))
  );

  assert.deepStrictEqual(result, {
    countQuery:
      "SELECT id AS id,name AS name FROM `a` WHERE (status = ?)  UNION ALL SELECT id AS id,(NULL) AS name FROM `b` WHERE (status = ?)  ",
    totalCountQuery:
      "SELECT SUM(countValue) AS countValue FROM ( SELECT COUNT(*) AS countValue  FROM `a` WHERE (status = ?)  UNION ALL SELECT COUNT(*) AS countValue  FROM `b` WHERE (status = ?)  ) AS totalCounts",
    query:
      "SELECT id AS id,name AS name FROM `a` WHERE (status = ?)  UNION ALL SELECT id AS id,(NULL) AS name FROM `b` WHERE (status = ?)  ORDER BY `id`ASC,`id`DESC LIMIT ?,?",
    replacements: ["Active", "Active", 10, 20],
  });
});

test("additionalWhereConditions can inline parenthesized subqueries", () => {
  const pagiHelp = new PagiHelp();
  const paginationObject = { search: "" };
  const options = [
    {
      tableName: "events",
      columnList: [{ name: "id", alias: "id" }],
      searchColumnList: [],
      additionalWhereConditions: [
        ["status", "IN", "(SELECT status FROM live_statuses)"],
      ],
    },
  ];

  const result = runQuietly(() =>
    pagiHelp.paginate(clone(paginationObject), clone(options))
  );

  assert.deepStrictEqual(result, {
    countQuery:
      "SELECT id AS id FROM `events` WHERE (status IN (SELECT status FROM live_statuses))  ",
    totalCountQuery:
      "SELECT COUNT(*) AS countValue  FROM `events` WHERE (status IN (SELECT status FROM live_statuses)) ",
    query:
      "SELECT id AS id FROM `events` WHERE (status IN (SELECT status FROM live_statuses))  ",
    replacements: [],
  });
});

test("additionalWhereConditions support raw expression fields with parameterized values", () => {
  const pagiHelp = new PagiHelp();
  const paginationObject = {
    search: "",
    pageNo: 1,
    itemsPerPage: 5,
  };
  const options = [
    {
      tableName: "support_raise_complain",
      columnList: [{ name: "id", alias: "id" }],
      searchColumnList: [],
      additionalWhereConditions: [
        [
          "(SELECT category_name FROM support_category WHERE id = support_raise_complain.category_id)",
          "=",
          "BGL",
        ],
      ],
    },
  ];

  const result = runQuietly(() =>
    pagiHelp.paginate(clone(paginationObject), clone(options))
  );

  assert.deepStrictEqual(result, {
    countQuery:
      "SELECT id AS id FROM `support_raise_complain` WHERE ((SELECT category_name FROM support_category WHERE id = support_raise_complain.category_id) = ?)  ",
    totalCountQuery:
      "SELECT COUNT(*) AS countValue  FROM `support_raise_complain` WHERE ((SELECT category_name FROM support_category WHERE id = support_raise_complain.category_id) = ?) ",
    query:
      "SELECT id AS id FROM `support_raise_complain` WHERE ((SELECT category_name FROM support_category WHERE id = support_raise_complain.category_id) = ?)   LIMIT ?,?",
    replacements: ["BGL", 0, 5],
  });
});

test("additionalWhereConditions accept a single raw tuple without an outer array", () => {
  const pagiHelp = new PagiHelp();
  const paginationObject = {
    search: "",
    pageNo: 2,
    itemsPerPage: 15,
  };
  const options = [
    {
      tableName: "coupons",
      columnList: [{ name: "id", alias: "id", prefix: "cc" }],
      additionalWhereConditions: ["cc.status", "!=", "Deleted"],
      searchColumnList: [],
      joinQuery: "cc",
    },
  ];

  const result = runQuietly(() =>
    pagiHelp.paginate(clone(paginationObject), clone(options))
  );

  assert.deepStrictEqual(result, {
    countQuery: "SELECT cc.id AS id FROM `coupons`cc WHERE cc.status != ?  ",
    totalCountQuery:
      "SELECT COUNT(*) AS countValue  FROM `coupons`cc WHERE cc.status != ? ",
    query:
      "SELECT cc.id AS id FROM `coupons`cc WHERE cc.status != ?   LIMIT ?,?",
    replacements: ["Deleted", 15, 15],
  });
});

test("omitting search with searchColumnList present keeps the current %undefined% behavior", () => {
  const pagiHelp = new PagiHelp();
  const paginationObject = {
    pageNo: 1,
    itemsPerPage: 10,
  };
  const options = [
    {
      tableName: "users",
      columnList: [
        { name: "id", alias: "id" },
        { name: "email", alias: "email" },
      ],
      searchColumnList: [{ name: "email" }],
    },
  ];

  const result = runQuietly(() =>
    pagiHelp.paginate(clone(paginationObject), clone(options))
  );

  assert.deepStrictEqual(result, {
    countQuery: "SELECT id AS id,email AS email FROM `users` WHERE ( email LIKE ?  ) ",
    totalCountQuery:
      "SELECT COUNT(*) AS countValue  FROM `users` WHERE ( email LIKE ?  )",
    query:
      "SELECT id AS id,email AS email FROM `users` WHERE ( email LIKE ?  )  LIMIT ?,?",
    replacements: ["%undefined%", 0, 10],
  });
});

test("empty filters and search keep the current dangling WHERE behavior", () => {
  const pagiHelp = new PagiHelp();
  const paginationObject = {
    search: "",
  };
  const options = [
    {
      tableName: "events",
      columnList: [{ name: "id", alias: "id" }],
      searchColumnList: [],
    },
  ];

  const result = runQuietly(() =>
    pagiHelp.paginate(clone(paginationObject), clone(options))
  );

  assert.deepStrictEqual(result, {
    countQuery: "SELECT id AS id FROM `events` WHERE  ",
    totalCountQuery: "SELECT COUNT(*) AS countValue  FROM `events` WHERE ",
    query: "SELECT id AS id FROM `events` WHERE  ",
    replacements: [],
  });
});

test("searchColumnList aliases preserve the current invalid SQL shape", () => {
  const pagiHelp = new PagiHelp();
  const paginationObject = {
    search: "mail",
  };
  const options = [
    {
      tableName: "users",
      columnList: [
        { name: "id", alias: "id" },
        { name: "email", alias: "email" },
      ],
      searchColumnList: [{ name: "email", alias: "email" }],
    },
  ];

  const result = runQuietly(() =>
    pagiHelp.paginate(clone(paginationObject), clone(options))
  );

  assert.deepStrictEqual(result, {
    countQuery:
      "SELECT id AS id,email AS email FROM `users` WHERE ( email AS email LIKE ?  ) ",
    totalCountQuery:
      "SELECT COUNT(*) AS countValue  FROM `users` WHERE ( email AS email LIKE ?  )",
    query:
      "SELECT id AS id,email AS email FROM `users` WHERE ( email AS email LIKE ?  ) ",
    replacements: ["%mail%"],
  });
});

test("parenthesized filter values stay parameterized in regular filters", () => {
  const pagiHelp = new PagiHelp();
  const paginationObject = {
    search: "",
    filters: ["status", "IN", "(SELECT status FROM live_statuses)"],
  };
  const options = [
    {
      tableName: "events",
      columnList: [
        { name: "id", alias: "id" },
        { name: "status", alias: "status" },
      ],
      searchColumnList: [],
    },
  ];

  const result = runQuietly(() =>
    pagiHelp.paginate(clone(paginationObject), clone(options))
  );

  assert.deepStrictEqual(result, {
    countQuery:
      "SELECT id AS id,status AS status FROM `events` WHERE (status IN ?)  ",
    totalCountQuery:
      "SELECT COUNT(*) AS countValue  FROM `events` WHERE (status IN ?) ",
    query:
      "SELECT id AS id,status AS status FROM `events` WHERE (status IN ?)  ",
    replacements: ["(SELECT status FROM live_statuses)"],
  });
});

test("pagination replacements keep offset and limit as the trailing two values", () => {
  const pagiHelp = new PagiHelp();
  const paginationObject = {
    search: "export",
    filters: ["status", "=", "Active"],
    sort: {
      attributes: ["created_at"],
      sorts: ["desc"],
    },
    pageNo: 3,
    itemsPerPage: 25,
  };
  const options = [
    {
      tableName: "reports",
      columnList: [
        { name: "id", alias: "id" },
        { name: "created_at", alias: "created_at" },
        { name: "status", alias: "status" },
        { name: "title", alias: "title" },
      ],
      searchColumnList: [{ name: "title" }],
    },
  ];

  const result = runQuietly(() =>
    pagiHelp.paginate(clone(paginationObject), clone(options))
  );

  assert.deepStrictEqual(result.replacements, ["Active", "%export%", 50, 25]);
  assert.deepStrictEqual(result.replacements.slice(-2), [50, 25]);
  assert.equal(result.query.endsWith("LIMIT ?,?"), true);
});

test("paginate mutates the caller sort arrays as part of current behavior", () => {
  const pagiHelp = new PagiHelp();
  const paginationObject = {
    search: "",
    sort: {
      attributes: ["created_at"],
      sorts: ["asc"],
    },
  };
  const options = [
    {
      tableName: "reports",
      columnList: [
        { name: "id", alias: "id" },
        { name: "created_at", alias: "created_at" },
      ],
      searchColumnList: [],
    },
  ];

  runQuietly(() => pagiHelp.paginate(paginationObject, clone(options)));

  assert.deepStrictEqual(paginationObject.sort.attributes, ["created_at", "id"]);
  assert.deepStrictEqual(paginationObject.sort.sorts, ["ASC", "DESC"]);
});

test("additionalWhereConditions bypass operator allow-list in raw mode", () => {
  const pagiHelp = new PagiHelp();
  const paginationObject = { search: "" };
  const options = [
    {
      tableName: "events",
      columnList: [{ name: "id", alias: "id" }],
      searchColumnList: [],
      additionalWhereConditions: [["name", "REGEXP", "^A"]],
    },
  ];

  const result = runQuietly(() =>
    pagiHelp.paginate(clone(paginationObject), clone(options))
  );

  assert.deepStrictEqual(result, {
    countQuery: "SELECT id AS id FROM `events` WHERE (name REGEXP ?)  ",
    totalCountQuery:
      "SELECT COUNT(*) AS countValue  FROM `events` WHERE (name REGEXP ?) ",
    query: "SELECT id AS id FROM `events` WHERE (name REGEXP ?)  ",
    replacements: ["^A"],
  });
});

test("json_overlaps is supported and stringifies object values", () => {
  const pagiHelp = new PagiHelp();
  const paginationObject = {
    search: "",
    filters: ["meta_info", "json_overlaps", { tags: ["vip"] }],
  };
  const options = [
    {
      tableName: "licenses",
      columnList: [
        { name: "id", alias: "id" },
        { name: "meta_info", prefix: "l", alias: "metaInfo" },
      ],
      joinQuery: " l",
      searchColumnList: [],
    },
  ];

  const result = runQuietly(() =>
    pagiHelp.paginate(clone(paginationObject), clone(options))
  );

  assert.deepStrictEqual(result, {
    countQuery:
      "SELECT id AS id,l.meta_info AS metaInfo FROM `licenses` l WHERE (JSON_OVERLAPS(l.meta_info, ?))  ",
    totalCountQuery:
      "SELECT COUNT(*) AS countValue  FROM `licenses` l WHERE (JSON_OVERLAPS(l.meta_info, ?)) ",
    query:
      "SELECT id AS id,l.meta_info AS metaInfo FROM `licenses` l WHERE (JSON_OVERLAPS(l.meta_info, ?))  ",
    replacements: ['{"tags":["vip"]}'],
  });
});

test("validated filter operators keep their current SQL shapes", () => {
  const pagiHelp = new PagiHelp();
  const paginationObject = {
    search: "",
    filters: [
      ["status", "not in", ["Deleted", "Archived"]],
      ["role", "! in", ["Guest"]],
      ["deletedAt", "is", null],
      ["approvedAt", "is not", null],
      ["name", "like", "A%"],
      ["name", "rlike", "^A"],
      ["groupId", "member of", "admins"],
    ],
  };
  const options = [
    {
      tableName: "users",
      columnList: [
        { name: "id", alias: "id" },
        { name: "status", alias: "status" },
        { name: "role", alias: "role" },
        { name: "deleted_at", alias: "deletedAt" },
        { name: "approved_at", alias: "approvedAt" },
        { name: "name", alias: "name" },
        { name: "group_id", alias: "groupId" },
      ],
      searchColumnList: [],
    },
  ];

  const result = runQuietly(() =>
    pagiHelp.paginate(clone(paginationObject), clone(options))
  );

  assert.deepStrictEqual(result, {
    countQuery:
      "SELECT id AS id,status AS status,role AS role,deleted_at AS deletedAt,approved_at AS approvedAt,name AS name,group_id AS groupId FROM `users` WHERE (status NOT IN (?,?) AND role ! IN (?) AND deleted_at IS ? AND approved_at IS NOT ? AND name LIKE ? AND name RLIKE ? AND group_id MEMBER OF ?)  ",
    totalCountQuery:
      "SELECT COUNT(*) AS countValue  FROM `users` WHERE (status NOT IN (?,?) AND role ! IN (?) AND deleted_at IS ? AND approved_at IS NOT ? AND name LIKE ? AND name RLIKE ? AND group_id MEMBER OF ?) ",
    query:
      "SELECT id AS id,status AS status,role AS role,deleted_at AS deletedAt,approved_at AS approvedAt,name AS name,group_id AS groupId FROM `users` WHERE (status NOT IN (?,?) AND role ! IN (?) AND deleted_at IS ? AND approved_at IS NOT ? AND name LIKE ? AND name RLIKE ? AND group_id MEMBER OF ?)  ",
    replacements: [
      "Deleted",
      "Archived",
      "Guest",
      null,
      null,
      "A%",
      "^A",
      "admins",
    ],
  });
});

test("validatePaginationObject reports structural errors and compatibility warnings", () => {
  const pagiHelp = new PagiHelp();
  const result = pagiHelp.validatePaginationObject({
    sort: {
      attributes: ["created_at"],
      sorts: ["asc", "sideways"],
    },
    pageNo: 1,
  });

  assert.deepStrictEqual(result, {
    valid: false,
    errors: [
      "paginationObject.sort.attributes and paginationObject.sort.sorts must have the same length",
      "paginationObject.sort.sorts[1] must be ASC or DESC",
      "paginationObject.pageNo and paginationObject.itemsPerPage must either both be provided or both be omitted",
    ],
    warnings: [
      'paginationObject.search is undefined; current paginate() will search for "%undefined%" when searchColumnList is non-empty',
      "paginationObject.sort will be mutated by paginate()",
    ],
  });
});

test("validateOptions reports unsafe option shapes without changing runtime behavior", () => {
  const pagiHelp = new PagiHelp();
  const result = pagiHelp.validateOptions([
    {
      tableName: "users",
      columnList: [
        { name: "id", alias: "id" },
        { name: "email" },
      ],
      searchColumnList: [{ name: "email", alias: "email" }],
      joinQuery: "u",
    },
  ]);

  assert.deepStrictEqual(result, {
    valid: false,
    errors: [
      "options[0].searchColumnList[0].alias is not supported in searchColumnList",
    ],
    warnings: [
      "options[0].columnList[1].alias is recommended for filters, sorts, and unions",
      "options[0].joinQuery is concatenated verbatim; ensure required whitespace and SQL syntax are included",
    ],
  });
});

test("validatePaginationInput checks filter fields against each option", () => {
  const pagiHelp = new PagiHelp();
  const result = pagiHelp.validatePaginationInput(
    {
      search: "",
      filters: ["missing", "=", 1],
    },
    [
      {
        tableName: "events",
        columnList: [
          { name: "id", alias: "id" },
          { name: "status", alias: "status" },
        ],
        searchColumnList: [],
      },
    ]
  );

  assert.deepStrictEqual(result, {
    valid: false,
    errors: [
      "paginationObject.filters are invalid for options[0]: Invalid filter field: missing",
    ],
    warnings: [],
  });
});

test("validatePaginationInput accepts valid legacy input without forcing behavior changes", () => {
  const pagiHelp = new PagiHelp();
  const result = pagiHelp.validatePaginationInput(
    {
      search: "",
      filters: ["status", "=", "Active"],
      pageNo: 1,
      itemsPerPage: 25,
    },
    [
      {
        tableName: "events",
        columnList: [
          { name: "id", alias: "id" },
          { name: "status", alias: "status" },
        ],
        searchColumnList: [],
      },
    ]
  );

  assert.deepStrictEqual(result, {
    valid: true,
    errors: [],
    warnings: [],
  });
});

test("invalid filter fields, operators, and sort values throw the current string errors", () => {
  const pagiHelp = new PagiHelp();

  expectThrowString(
    () =>
      runQuietly(() =>
        pagiHelp.paginate(
          { search: "", filters: ["missing", "=", 1] },
          [
            {
              tableName: "events",
              columnList: [{ name: "id", alias: "id" }],
              searchColumnList: [],
            },
          ]
        )
      ),
    "Invalid filter field: missing"
  );

  expectThrowString(
    () =>
      runQuietly(() =>
        pagiHelp.paginate(
          { search: "", filters: ["id", "BETWEEN", [1, 2]] },
          [
            {
              tableName: "events",
              columnList: [{ name: "id", alias: "id" }],
              searchColumnList: [],
            },
          ]
        )
      ),
    "Invalid Operator"
  );

  expectThrowString(
    () =>
      runQuietly(() =>
        pagiHelp.paginate(
          {
            search: "",
            sort: {
              attributes: ["id"],
              sorts: ["sideways"],
            },
          },
          [
            {
              tableName: "events",
              columnList: [{ name: "id", alias: "id" }],
              searchColumnList: [{ name: "id" }],
            },
          ]
        )
      ),
    "INVALID SORT VALUE"
  );
});

let failed = 0;

for (const { name, fn } of tests) {
  try {
    fn();
    process.stdout.write(`PASS ${name}\n`);
  } catch (error) {
    failed += 1;
    process.stdout.write(`FAIL ${name}\n`);
    process.stderr.write(`${error.stack || error}\n`);
  }
}

if (failed > 0) {
  process.exitCode = 1;
}
