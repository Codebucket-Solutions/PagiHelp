# PagiHelp

Generalized api helper for  search and filter with pagination for mysql

## Installation

    npm install pagi-help

### Include
Include into js app using common js.
```
const pagiHelp = require("pagi-help")
```

### Usage

PagiHelp Is a helper utility which can be used to generalize and manage server side offset pagination (As of now only for mysql) . It comprises of two sections.

![alt text](https://github.com/Codebucket-Solutions/PagiHelp/blob/master/diagram.png)

#### Body

The body is the request body being expected from the client.

```
{  
    "search": "xyz",  
    "sort": {  
        "attributes": ["created_date"],  
        "sorts": ["asc"]  
    },    
    "filters":[  
        ["from_date","=","2022-05-05"],  
        [   
	        ["campaign_description","=","abc"],  
			["to_date","=","2022-06-05"]  
        ]    
    ],    
    "pageNo": 1,  
    "itemsPerPage": 2  
}
```

1. search - Text string to Search
2. filters - filters is an array of following format. It can be nested to allow client to use highly complex filters. Explained in Filters Section.
3. sort - order by the attributes provided.

##### Filters (Examples)
* And
```
"filters":[  
	        ["from_date","=","2022-05-05"],  
	        ["to_date","=","2022-05-06"]
        ]
```

translates to 
```
`from_date` =  "2022-05-05" and `to_date` = "2022-05-06"
```

* Or
```
"filters":[  
	        [["from_date","=","2022-05-05"],  ["to_date","=","2022-05-06"]]
	    ]
```

translates to 
```
`from_date` =  "2022-05-05" or `to_date` = "2022-05-06"
```

* Combination
```
 "filters":[  
        ["from_date","=","2022-05-05"],  
        [   
	        ["campaign_description","=","abc"],  
            ["to_date","=","2022-06-05"]  
        ]    
    ]
```

translates to 
```
`from_date` =  "2022-05-05" and (`campaign_description` = "abc" OR `to_date` = "2022-06-05")
```

* Nesting To All levels is supported
  
* Other operands 
* IN
```
 "filters":[  
        ["campaign_description","in",["abc","def","ghi"]],  
    ]
```
* Greater Than/ Less Than etc.
 ```
 "filters":[  
        ["amount",">",22],  
    ]
```


#### Configuration

> **_NOTE:_**  Aliases are required for PagiHelp to Work
> **_NOTE:_**  An alias id is required for PagiHelp to work. To give proper results for paging.


* Basic Configuration (Single Table with No Joins)

```
let paginationArr = [];  
paginationArr.push({  
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
  ],});  
  
let pagiHelp= new PagiHelp();  
  
let paginationQueries = pagiHelp.paginate(body, paginationArr);

let totalCount = await sequelize.query(paginationQueries.countQuery, {  
  replacements: paginationQueries.replacements,  
  type: QueryTypes.SELECT,  
}); 
  
let data = await sequelize.query(paginationQueries.query, {  
  replacements: paginationQueries.replacements,  
  type: QueryTypes.SELECT,  
});  
  
return {  
  data,  
  totalCount: totalCount.length,  
};


```

*columnList* contains list of all columns which will be returned. The *alias* is required.
 *name* is the name of the column in the table,It can be replaced with *statement* which may contain an sql statement (in next example) .

*additionalWhereConditions* is an array with same structure as filters. it is used to provide additional conditions that may be required.    

*searchColumnList* is an array of objects which contains list of those columns on which the search will take place

* Advanced Configuration (Table with Joins)
```
let paginationArr = [];
      paginationArr.push({
        tableName: "licenses",
        columnList: [
          { name: "license_id", prefix: "l", alias: "id" },
          { name: "service_type", prefix: "l", alias: "service_type" },
          { name: "stage", prefix: "l", alias: "stage" },
          { name: "application_no", prefix: "l", alias: "application_no" },
          {
            name: "final_submit_date",
            prefix: "l",
            alias: "final_submit_date",
          },
          { name: "created_date", prefix: "l", alias: "created_date" },
          { name: "updated_date", prefix: "l", alias: "updated_date" },
          { name: "email", prefix: "i", alias: "email" },
          { name: "first_name", prefix: "i", alias: "first_name" },
          { name: "last_name", prefix: "i", alias: "last_name" },
          { name: "phone", prefix: "i", alias: "phone" },
          {
            statement:
                '(SELECT IF(l.assigned_to="'+user.userId+`","Yes","No"))`,
            alias: "assigned_to_me",
          },
          {
            statement:
                '(SELECT IF(l.assigned_to="'+user.userId+`","No","Yes"))`,
            alias: "processed_by_me",
          }
        ],
        additionalWhereConditions: [["l.status", "=", "Active"]],  
        searchColumnList: [
          { name: "service_type", prefix: "l" },
          { name: "stage", prefix: "l" },
          { name: "application_no", prefix: "l" },
          { name: "final_submit_date", prefix: "l" },
          { name: "created_date", prefix: "l" },
          { name: "updated_date", prefix: "l" },
          { name: "email", prefix: "i" },
          { name: "first_name", prefix: "i" },
          { name: "last_name", prefix: "i" },
          { name: "phone", prefix: "i" },
        ],
        joinQuery:
          " l left join `investor_registration` i on " +
          "l.investor_id = i.investor_id ",
        additionalWhereConditions: [["l.status", "=", "Active"]],
      });
      
      let pagiHelp = new PagiHelp({
        columnNameConverter: (x) =>
          x.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
      });
      
      let paginationQueries = pagiHelp.paginate(body, paginationArr);
      let totalCount = await sequelize.query(paginationQueries.countQuery, {
        replacements: paginationQueries.replacements,
        type: QueryTypes.SELECT,
      });
      let data = await sequelize.query(paginationQueries.query, {
        replacements: paginationQueries.replacements,
        type: QueryTypes.SELECT,
      });
      return {
        data,
        totalCount: totalCount.length,
```
  
*columnNameConverter* is a function which will convert the aliases coming from the request body to the required format as one wants. it has one parameter which is the alias name.  In the above example  camelcase alias is being converted to snakecase to abide by the table structure.
IT can be skipped if not required


* Advanced Configuration (Multiple Tables (UNION) )
  
Multiple tables can be unioned and searched and queried by simply passing another pagination object in the array. *PagiHelp intelligently returns "" for the aliases that might not be present.*

```
let paginationArr = [];  
paginationArr.push({  
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
  ],});  

paginationArr.push({  
  tableName: "campaigns2",  
  columnList: [  
    { name: "campaign_id", alias: "id" },  
    { name: "campaign_name", alias: "campaign_name" },  
    { name: "campaign_description", alias: "campaign_description" },  
  ],  
  additionalWhereConditions: [["status", "=", "Active"]],  
  searchColumnList: [  
    { name: "campaign_name" },  
    { name: "campaign_description" },  
  ],});  
  
let pagiHelp= new PagiHelp();  
  
let paginationQueries = pagiHelp.paginate(body, paginationArr);

let totalCount = await sequelize.query(paginationQueries.countQuery, {  
  replacements: paginationQueries.replacements,  
  type: QueryTypes.SELECT,  
}); 
  
let data = await sequelize.query(paginationQueries.query, {  
  replacements: paginationQueries.replacements,  
  type: QueryTypes.SELECT,  
});  
  
return {  
  data,  
  totalCount: totalCount.length,  
};


```
