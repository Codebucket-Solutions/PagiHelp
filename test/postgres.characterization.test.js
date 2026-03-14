const {
  assert,
  clone,
  expectThrowMessage,
  runQuietly,
  test,
} = require("./support/harness");

const PagiHelpV210 = require("../v2");

test("v2 postgres accepts a constructor dialect and preserves helper rendering", () => {
  const pagiHelp = new PagiHelpV210({
    dialect: "postgres",
  });

  assert.equal(pagiHelp.dialect, "postgres");
  assert.deepStrictEqual(
    pagiHelp.columNames([
      { name: "id", alias: "id" },
      { name: "created_at", prefix: "u", alias: "createdAt" },
      { statement: "COUNT(*)", alias: "countValue" },
    ]),
    [
      "id AS id",
      "u.created_at AS createdAt",
      "COUNT(*) AS countValue",
    ]
  );

  const tupleReplacements = [];
  assert.equal(
    pagiHelp.tupleCreator(["profile", "JSON_CONTAINS", { active: true }], tupleReplacements),
    "(profile)::jsonb @> (?::jsonb)"
  );
  assert.deepStrictEqual(tupleReplacements, ['{"active":true}']);
});

test("v2 postgres generates aggregate count queries and LIMIT/OFFSET in postgres order", () => {
  const pagiHelp = new PagiHelpV210({
    dialect: "postgres",
  });
  const paginationObject = {
    search: "mail",
    sort: {
      attributes: ["createdAt"],
      sorts: ["desc"],
    },
    filters: [
      ["assignedToMe", "=", "Yes"],
      ["l.stage", "in", ["NEW", "PROCESSING"]],
      ["metaInfo", "json_contains", { a: 1 }],
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
        { name: "created_at", prefix: "l", alias: "createdAt" },
        { name: "stage", prefix: "l", alias: "stage" },
        { name: "meta_info", prefix: "l", alias: "metaInfo" },
        { name: "tags", prefix: "l", alias: "tags" },
        {
          statement:
            "(CASE WHEN l.assigned_to = '1' THEN 'Yes' ELSE 'No' END)",
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

  const result = runQuietly(() =>
    pagiHelp.paginate(clone(paginationObject), clone(options))
  );

  assert.deepStrictEqual(result, {
    countQuery:
      'SELECT COUNT(*) AS countValue  FROM "licenses" l LEFT JOIN investor_registration i ON l.investor_id = i.investor_id WHERE (l.status = ?) AND ((CASE WHEN l.assigned_to = \'1\' THEN \'Yes\' ELSE \'No\' END) = ? AND l.stage IN (?,?) AND (l.meta_info)::jsonb @> (?::jsonb) AND array_position(string_to_array(COALESCE(l.tags::text, \'\'), \',\'), ?::text) IS NOT NULL) AND ( i.email LIKE ? OR l.stage LIKE ? )',
    totalCountQuery:
      'SELECT COUNT(*) AS countValue  FROM "licenses" l LEFT JOIN investor_registration i ON l.investor_id = i.investor_id WHERE (l.status = ?) AND ((CASE WHEN l.assigned_to = \'1\' THEN \'Yes\' ELSE \'No\' END) = ? AND l.stage IN (?,?) AND (l.meta_info)::jsonb @> (?::jsonb) AND array_position(string_to_array(COALESCE(l.tags::text, \'\'), \',\'), ?::text) IS NOT NULL) AND ( i.email LIKE ? OR l.stage LIKE ? )',
    query:
      'SELECT l.license_id AS id,l.created_at AS createdAt,l.stage AS stage,l.meta_info AS metaInfo,l.tags AS tags,(CASE WHEN l.assigned_to = \'1\' THEN \'Yes\' ELSE \'No\' END) AS assignedToMe,i.email AS email FROM "licenses" l LEFT JOIN investor_registration i ON l.investor_id = i.investor_id WHERE (l.status = ?) AND ((CASE WHEN l.assigned_to = \'1\' THEN \'Yes\' ELSE \'No\' END) = ? AND l.stage IN (?,?) AND (l.meta_info)::jsonb @> (?::jsonb) AND array_position(string_to_array(COALESCE(l.tags::text, \'\'), \',\'), ?::text) IS NOT NULL) AND ( i.email LIKE ? OR l.stage LIKE ? ) ORDER BY "createdAt"DESC,"id"DESC LIMIT ? OFFSET ?',
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

test("v2 postgres uses LIMIT/OFFSET for direct offset pagination too", () => {
  const pagiHelp = new PagiHelpV210({
    dialect: "postgres",
  });

  const result = runQuietly(() =>
    pagiHelp.paginate(
      {
        search: "",
        offset: 3,
        limit: 7,
      },
      [
        {
          tableName: "users",
          columnList: [
            { name: "id", alias: "id" },
            { name: "email", alias: "email" },
          ],
          searchColumnList: [{ name: "email" }],
        },
      ]
    )
  );

  assert.equal(
    result.query,
    'SELECT id AS id,email AS email FROM "users" LIMIT ? OFFSET ?'
  );
  assert.deepStrictEqual(result.replacements, [7, 3]);
});

test("v2 postgres normalizes joinQuery and omits empty WHERE clauses", () => {
  const pagiHelp = new PagiHelpV210({
    dialect: "postgres",
  });

  const result = pagiHelp.singleTablePagination(
    "events",
    {
      search: "",
    },
    [],
    "e",
    [{ name: "id", alias: "id" }]
  );

  assert.deepStrictEqual(result, {
    countQuery: 'SELECT COUNT(*) AS countValue  FROM "events" e',
    totalCountQuery: 'SELECT COUNT(*) AS countValue  FROM "events" e',
    query: 'SELECT id AS id FROM "events" e',
    replacements: [],
  });
});

test("v2 postgres treats missing search and searchColumnList as empty values", () => {
  const pagiHelp = new PagiHelpV210({
    dialect: "postgres",
  });
  const paginationObject = {
    sort: {
      attributes: ["createdAt"],
      sorts: ["asc"],
    },
    pageNo: 1,
    itemsPerPage: 10,
  };
  const options = [
    {
      tableName: "users",
      columnList: [
        { name: "id", alias: "id" },
        { name: "created_at", alias: "createdAt" },
      ],
    },
  ];

  const result = runQuietly(() =>
    pagiHelp.paginate(clone(paginationObject), clone(options))
  );

  assert.deepStrictEqual(result, {
    countQuery: 'SELECT COUNT(*) AS countValue  FROM "users"',
    totalCountQuery: 'SELECT COUNT(*) AS countValue  FROM "users"',
    query:
      'SELECT id AS id,created_at AS createdAt FROM "users" ORDER BY "createdAt"ASC,"id"DESC LIMIT ? OFFSET ?',
    replacements: [10, 0],
  });
});

test("v2 postgres rejects alias in searchColumnList", () => {
  const pagiHelp = new PagiHelpV210({
    dialect: "postgres",
  });

  expectThrowMessage(
    () =>
      runQuietly(() =>
        pagiHelp.paginate(
          { search: "mail" },
          [
            {
              tableName: "users",
              columnList: [
                { name: "id", alias: "id" },
                { name: "email", alias: "email" },
              ],
              searchColumnList: [{ name: "email", alias: "email" }],
            },
          ]
        )
      ),
    "options[0].searchColumnList[0].alias is not supported in searchColumnList"
  );
});

test("v2 postgres supports dotted search columns and raw additionalWhereConditions", () => {
  const pagiHelp = new PagiHelpV210({
    dialect: "postgres",
  });

  const result = runQuietly(() =>
    pagiHelp.paginate(
      {
        search: "group",
        filters: ["groupName", "=", "VIP"],
        pageNo: 1,
        itemsPerPage: 3,
      },
      [
        {
          tableName: "xcommunity_groups",
          columnList: [
            { name: "id", prefix: "xg", alias: "id" },
            { name: "group_name", prefix: "xg", alias: "groupName" },
          ],
          searchColumnList: [{ name: "xg.group_name" }],
          joinQuery: "xg",
          additionalWhereConditions: ["xg.status", "!=", "Deleted"],
        },
      ]
    )
  );

  assert.deepStrictEqual(result, {
    countQuery:
      'SELECT COUNT(*) AS countValue  FROM "xcommunity_groups" xg WHERE xg.status != ? AND (xg.group_name = ?) AND ( xg.group_name LIKE ? )',
    totalCountQuery:
      'SELECT COUNT(*) AS countValue  FROM "xcommunity_groups" xg WHERE xg.status != ? AND (xg.group_name = ?) AND ( xg.group_name LIKE ? )',
    query:
      'SELECT xg.id AS id,xg.group_name AS groupName FROM "xcommunity_groups" xg WHERE xg.status != ? AND (xg.group_name = ?) AND ( xg.group_name LIKE ? ) LIMIT ? OFFSET ?',
    replacements: ["Deleted", "VIP", "%group%", 3, 0],
  });
});

test("v2 postgres maps JSON_OVERLAPS, MEMBER OF, RLIKE, and ! IN to postgres SQL", () => {
  const pagiHelp = new PagiHelpV210({
    dialect: "postgres",
  });

  const result = runQuietly(() =>
    pagiHelp.paginate(
      {
        search: "",
        filters: [
          ["metaInfo", "JSON_OVERLAPS", { tags: ["vip"] }],
          ["groupId", "MEMBER OF", [1, 2, 3]],
          ["name", "RLIKE", "^A"],
          ["role", "! IN", ["Guest"]],
          ["deletedAt", "IS", null],
          ["approvedAt", "IS NOT", null],
        ],
      },
      [
        {
          tableName: "users",
          columnList: [
            { name: "id", alias: "id" },
            { name: "meta_info", alias: "metaInfo" },
            { name: "group_id", alias: "groupId" },
            { name: "name", alias: "name" },
            { name: "role", alias: "role" },
            { name: "deleted_at", alias: "deletedAt" },
            { name: "approved_at", alias: "approvedAt" },
          ],
          searchColumnList: [],
        },
      ]
    )
  );

  assert.deepStrictEqual(result, {
    countQuery:
      'SELECT COUNT(*) AS countValue  FROM "users" WHERE ((CASE WHEN jsonb_typeof((meta_info)::jsonb) = \'array\' AND jsonb_typeof(?::jsonb) = \'array\' THEN EXISTS (SELECT 1 FROM jsonb_array_elements((meta_info)::jsonb) AS left_values(value) INNER JOIN jsonb_array_elements(?::jsonb) AS right_values(value) ON left_values.value = right_values.value) WHEN jsonb_typeof((meta_info)::jsonb) = \'object\' AND jsonb_typeof(?::jsonb) = \'object\' THEN EXISTS (SELECT 1 FROM jsonb_each((meta_info)::jsonb) AS left_pairs(key, value) INNER JOIN jsonb_each(?::jsonb) AS right_pairs(key, value) ON left_pairs.key = right_pairs.key AND left_pairs.value = right_pairs.value) WHEN jsonb_typeof((meta_info)::jsonb) = \'array\' THEN ((meta_info)::jsonb @> ?::jsonb) WHEN jsonb_typeof(?::jsonb) = \'array\' THEN (?::jsonb @> (meta_info)::jsonb) ELSE ((meta_info)::jsonb = ?::jsonb) END) AND (?::jsonb @> to_jsonb(group_id)) AND name ~ ? AND role NOT IN (?) AND deleted_at IS NULL AND approved_at IS NOT NULL)',
    totalCountQuery:
      'SELECT COUNT(*) AS countValue  FROM "users" WHERE ((CASE WHEN jsonb_typeof((meta_info)::jsonb) = \'array\' AND jsonb_typeof(?::jsonb) = \'array\' THEN EXISTS (SELECT 1 FROM jsonb_array_elements((meta_info)::jsonb) AS left_values(value) INNER JOIN jsonb_array_elements(?::jsonb) AS right_values(value) ON left_values.value = right_values.value) WHEN jsonb_typeof((meta_info)::jsonb) = \'object\' AND jsonb_typeof(?::jsonb) = \'object\' THEN EXISTS (SELECT 1 FROM jsonb_each((meta_info)::jsonb) AS left_pairs(key, value) INNER JOIN jsonb_each(?::jsonb) AS right_pairs(key, value) ON left_pairs.key = right_pairs.key AND left_pairs.value = right_pairs.value) WHEN jsonb_typeof((meta_info)::jsonb) = \'array\' THEN ((meta_info)::jsonb @> ?::jsonb) WHEN jsonb_typeof(?::jsonb) = \'array\' THEN (?::jsonb @> (meta_info)::jsonb) ELSE ((meta_info)::jsonb = ?::jsonb) END) AND (?::jsonb @> to_jsonb(group_id)) AND name ~ ? AND role NOT IN (?) AND deleted_at IS NULL AND approved_at IS NOT NULL)',
    query:
      'SELECT id AS id,meta_info AS metaInfo,group_id AS groupId,name AS name,role AS role,deleted_at AS deletedAt,approved_at AS approvedAt FROM "users" WHERE ((CASE WHEN jsonb_typeof((meta_info)::jsonb) = \'array\' AND jsonb_typeof(?::jsonb) = \'array\' THEN EXISTS (SELECT 1 FROM jsonb_array_elements((meta_info)::jsonb) AS left_values(value) INNER JOIN jsonb_array_elements(?::jsonb) AS right_values(value) ON left_values.value = right_values.value) WHEN jsonb_typeof((meta_info)::jsonb) = \'object\' AND jsonb_typeof(?::jsonb) = \'object\' THEN EXISTS (SELECT 1 FROM jsonb_each((meta_info)::jsonb) AS left_pairs(key, value) INNER JOIN jsonb_each(?::jsonb) AS right_pairs(key, value) ON left_pairs.key = right_pairs.key AND left_pairs.value = right_pairs.value) WHEN jsonb_typeof((meta_info)::jsonb) = \'array\' THEN ((meta_info)::jsonb @> ?::jsonb) WHEN jsonb_typeof(?::jsonb) = \'array\' THEN (?::jsonb @> (meta_info)::jsonb) ELSE ((meta_info)::jsonb = ?::jsonb) END) AND (?::jsonb @> to_jsonb(group_id)) AND name ~ ? AND role NOT IN (?) AND deleted_at IS NULL AND approved_at IS NOT NULL)',
    replacements: [
      '{"tags":["vip"]}',
      '{"tags":["vip"]}',
      '{"tags":["vip"]}',
      '{"tags":["vip"]}',
      '{"tags":["vip"]}',
      '{"tags":["vip"]}',
      '{"tags":["vip"]}',
      '{"tags":["vip"]}',
      "[1,2,3]",
      "^A",
      "Guest",
    ],
  });
});

test("v2 postgres throws Error objects for invalid dialects and invalid operators", () => {
  expectThrowMessage(
    () =>
      new PagiHelpV210({
        dialect: "sqlite",
      }),
    'constructor.dialect must be "mysql" or "postgres"'
  );

  const pagiHelp = new PagiHelpV210({
    dialect: "postgres",
  });

  expectThrowMessage(
    () => pagiHelp.tupleCreator(["id", "BETWEEN", [1, 2]], []),
    "Invalid Operator"
  );
});
