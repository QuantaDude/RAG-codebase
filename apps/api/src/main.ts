import Parser from "tree-sitter";
import cpp from "tree-sitter-cpp";
import javascript from "tree-sitter-javascript";
import { open } from "node:fs/promises";
import { Buffer, buffer } from "node:buffer";
import initDB from "./db";
import { pgTable } from "drizzle-orm/pg-core/table";
import { integer, varchar } from "drizzle-orm/pg-core/columns";
import { fileURLToPath } from "url";
import path from "path";
import { getLlama, LlamaChatSession } from "node-llama-cpp";
import ParseDotEnv from "./utils";
import { CodeItem, IndexedCodeItem } from "./types";

Object.assign(process.env, await ParseDotEnv());

const db = initDB();



const llama = await getLlama();

const model = await llama.loadModel({
   modelPath: "./models/jina-code-embeddings-0.5b-BF16.gguf",
   gpuLayers: 0,
});

// -------------------------
// Query-understanding LLM
// -------------------------

const llmModel = await llama.loadModel({
   modelPath: "./models/Qwen3-4B-Instruct-2507-Q5_K_M.gguf",
   gpuLayers: 16
});

const llmContext = await llmModel.createContext();

const session = new LlamaChatSession({
   contextSequence: llmContext.getSequence(),
});


// -------------------------
// User query
// -------------------------

const query = "Find a method inside a class called Math that does arithmetic addition of two numbers and returns an integer. The function takes in two integers. One of the parameters is named abhirup.";


// -------------------------
// Ask Qwen to extract filters
// -------------------------


const filterPrompt = `
You are a query parser for a source-code search engine.

Your job is to extract ONLY structural constraints from the user's query.

Do NOT answer the query.
Do NOT search for code.
Do NOT explain anything.
Return ONLY one valid JSON object.

The JSON object may contain these fields:

{
  "kind": "function" | "class" | "method",
  "parameterCount": number,
  "parameterNames": string[],
  "parameterTypes": string[],
  "returnType": string
}

Rules:

1. "kind"
   Extract it when the user explicitly refers to:
   - a function
   - a method
   - a class

2. "parameterCount"
   Extract the exact number of parameters when explicitly stated.

   Examples:
   "takes two arguments" -> 2
   "accepts 3 parameters" -> 3
   "takes no arguments" -> 0
   "doesn't take any parameters" -> 0

3. "parameterNames"

A parameter name is the LITERAL identifier used in source code.

Extract a parameter name ONLY when the user explicitly provides
the literal identifier.

A natural-language description of a parameter is NOT a parameter name.

Examples of parameter DESCRIPTIONS:
- user ID
- user identifier
- configuration object
- database connection
- username
- maximum size
- file path
- authentication token

These descriptions MUST NOT be converted into parameter names.

For example:

"accepts a user ID"
->
parameterNames: []

"accepts a configuration object"
->
parameterNames: []

"accepts a user ID and a configuration object"
->
parameterNames: []

"accepts a parameter named userId"
->
parameterNames: ["userId"]

"accepts an argument called userId"
->
parameterNames: ["userId"]

"the first parameter is userId"
->
parameterNames: ["userId"]

"the second parameter is named config"
->
parameterNames: ["", "config"]

A valid parameter name MUST be a single source-code identifier.

For this task, an identifier:
- starts with A-Z, a-z, or _
- contains only A-Z, a-z, 0-9, or _
- contains no spaces
- contains no hyphens
- contains no punctuation
- is not a natural-language phrase

Valid identifiers:
"userId"
"config"
"maxSize"
"max_size"
"_value"
"arg1"

Invalid parameter names:
"user ID"
"user id"
"user identifier"
"the user's ID"
"configuration object"
"file path"
"maximum size"
"user-id"

NEVER transform a description into an identifier.

For example:

"takes a user ID"
MUST produce:
[]

It MUST NOT produce:
["userId"]

"takes a configuration object"
MUST produce:
[]

It MUST NOT produce:
["config"]

"takes a username"
MUST produce:
[]

It MUST NOT produce:
["username"]

Even if a description happens to look like a common variable name,
it is still a description unless the user explicitly identifies it
as a source-code parameter name.

For example:

"takes a username and password"
->
[]

NOT:
["username", "password"]

However:

"takes parameters named username and password"
->
["username", "password"]

Parameter names are positional.

If the user explicitly identifies the position of a parameter,
preserve that position.

Example:

"first parameter is named userId"
->
["userId"]

Example:

"second parameter is named config"
->
["", "config"]

If the user explicitly provides multiple parameter names and their
order is clear:

"parameters named userId and config, in that order"
->
["userId", "config"]

If the order cannot be determined, do NOT guess.

Example:

"parameters named userId and config"
->
[]

If only some parameter names are explicitly known and their
positions are known, preserve the positions and use an empty string
for unknown positions.

NEVER invent a missing parameter name.
NEVER infer a parameter name from its meaning.
NEVER infer a parameter name from its type.
NEVER infer a parameter name from common programming conventions.

4. "parameterTypes"
   Extract parameter types ONLY when the user explicitly specifies them.

   The ordering matters.

   The first element describes the first parameter.
   The second element describes the second parameter.
   The third element describes the third parameter, etc.

   Examples:

   "takes two numbers"
   ->
   ["number", "number"]

   "accepts a string and a number"
   ->
   ["string", "number"]

   "takes a boolean"
   ->
   ["boolean"]

   "takes a string followed by a number"
   ->
   ["string", "number"]

   Use these normalized type names when applicable:
   - number
   - string
   - boolean
   - object
   - array
   - function
   - unknown

   Do NOT infer a type from the parameter's name.

   Example:

   "takes a parameter named 'age'"
   ->
   parameterTypes should be []

   Do NOT assume:
   ["number"]

5. "returnType"
   Extract the return type when explicitly stated.

   Examples:

   "returns a number"
   ->
   "number"

   "returns a string"
   ->
   "string"

   "returns nothing"
   ->
   "void"

   "doesn't return anything"
   ->
   "void"

   "returns a boolean"
   ->
   "boolean"

6. Relationship between parameterNames, parameterTypes and parameterCount

   These fields are independent.

   Only include information that the user explicitly provides.

   Do NOT fill in missing information using assumptions.

   Example:

   "find functions that take two numbers"

   ->
   {
     "kind": "function",
     "parameterCount": 2,
     "parameterNames": [],
     "parameterTypes": ["number", "number"]
   }

   Example:

   "find functions that take two parameters named 'a' and 'b'"

   ->
   {
     "kind": "function",
     "parameterCount": 2,
     "parameterNames": ["a", "b"]
   }

   Example:

   "find functions that take a parameter named 'a' and a number"

   If the query does not make the positional order unambiguous,
   do not guess the order.

   ->
   {
     "kind": "function",
     "parameterNames": [],
     "parameterTypes": []
   }

7. Do NOT infer structural information from semantic descriptions.

   Example:

   "function that calculates the average"
   ->
   {}

   Do NOT assume it takes numbers.

8. Keep semantic information OUT of the JSON.

   Example:

   "function that takes two numbers and calculates their sum"

   ->
   {
     "kind": "function",
     "parameterCount": 2,
     "parameterTypes": ["number", "number"]
   }

   The phrase "calculates their sum" is semantic information.
   It must NOT appear in the JSON.

9. If the query contains no structural constraints, return:

   {}

10. Never add fields that aren't explicitly supported by the schema.

11. Never use null.

12. Never invent parameter names.

13. Never invent parameter types.

14. Never infer missing positional information.

15. Never use markdown code fences.

16. Return valid JSON and nothing else.

Examples:

User query:
"find functions that take two numbers and don't return anything"

Output:
{
  "kind": "function",
  "parameterCount": 2,
  "parameterNames": [],
  "parameterTypes": ["number", "number"],
  "returnType": "void"
}

User query:
"find functions with no arguments"

Output:
{
  "kind": "function",
  "parameterCount": 0,
  "parameterNames": []
}

User query:
"find functions that return a string"

Output:
{
  "kind": "function",
  "returnType": "string"
}

User query:
"find methods that accept a string and a boolean"

Output:
{
  "kind": "method",
  "parameterCount": 2,
  "parameterNames": [],
  "parameterTypes": ["string", "boolean"]
}

User query:
"find functions with a parameter named 'userId'"

Output:
{
  "kind": "function",
  "parameterNames": ["userId"]
}

User query:
"find functions with parameters named 'userId' and 'includeDeleted'"

Output:
{
  "kind": "function",
  "parameterCount": 2,
  "parameterNames": ["userId", "includeDeleted"]
}

User query:
"find functions with a parameter called 'userId' and a boolean"

Output:
{
  "kind": "function",
  "parameterNames": [],
  "parameterTypes": []
}

User query:
"find functions that take a parameter called 'userId' followed by a boolean"

Output:
{
  "kind": "function",
  "parameterCount": 2,
  "parameterNames": ["userId"],
  "parameterTypes": ["unknown", "boolean"]
}

User query:
"find code that parses JSON"

Output:
{}

User query:
"find classes related to authentication"

Output:
{
  "kind": "class"
}

User query:
"find a function that takes two numbers and calculates their average"

Output:
{
  "kind": "function",
  "parameterCount": 2,
  "parameterNames": [],
  "parameterTypes": ["number", "number"]
}

Now parse this user query:

${query}
`;

const response = await session.prompt(filterPrompt);

console.log(response);
llmContext.dispose();

const context = await model.createEmbeddingContext();


// --------------------------------------------------
// 1. Our "code database"
// --------------------------------------------------

const code: CodeItem[] = [
   {
      id: 1,
      name: "sum",
      kind: "function",
      parameters: [
         { name: "a", type: "number" },
         { name: "b", type: "number" },
      ],
      returnType: "number",
      code: `
function sum(a: number, b: number): number {
    return a + b;
}
`,
   },

   {
      id: 2,
      name: "multiply",
      kind: "function",
      parameters: [
         { name: "a", type: "number" },
         { name: "b", type: "number" },
      ],
      returnType: "number",
      code: `
function multiply(a: number, b: number): number {
    return a * b;
}
`,
   },

   {
      id: 3,
      name: "getRandomText",
      kind: "function",
      parameters: [],
      returnType: "string",
      code: `
function getRandomText(): string {
    return "hello world";
}
`,
   },

   {
      id: 4,
      name: "getUserName",
      kind: "function",
      parameters: [
         { name: "userId", type: "number" },
      ],
      returnType: "string",
      code: `
function getUserName(userId: number): string {
    return database.users[userId].name;
}
`,
   },

   {
      id: 5,
      name: "logMessage",
      kind: "function",
      parameters: [
         { name: "message", type: "string" },
      ],
      returnType: "void",
      code: `
function logMessage(message: string): void {
    console.log(message);
}
`,
   },
];


// --------------------------------------------------
// 2. Convert code into an embedding document
// --------------------------------------------------

function toEmbeddingDocument(item: CodeItem): string {
   const parameters =
      item.parameters.length === 0
         ? "none"
         : item.parameters
            .map(p => `${p.name} (${p.type})`)
            .join(", ");

   return `
Function name: ${item.name}
Type: ${item.kind}
Parameters: ${parameters}
Return type: ${item.returnType}

Code:
${item.code}
`;
}


// --------------------------------------------------
// 3. Index the code
// --------------------------------------------------

const index: IndexedCodeItem[] = [];

for (const item of code) {
   const document = toEmbeddingDocument(item);

   const embedding = await context.getEmbeddingFor(document);

   index.push({
      ...item,
      embedding: embedding.vector,
   });
}

console.log(`Indexed ${index.length} functions`);


// --------------------------------------------------
// 4. Cosine similarity
// --------------------------------------------------

function cosineSimilarity(
   a: number[],
   b: number[],
): number {
   let dot = 0;
   let magnitudeA = 0;
   let magnitudeB = 0;

   for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magnitudeA += a[i] ** 2;
      magnitudeB += b[i] ** 2;
   }

   return (
      dot /
      (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB))
   );
}


// --------------------------------------------------
// 5. Structural filtering
// --------------------------------------------------

type Filters = {
   kind?: "function";
   parameterCount?: number;
   parameterTypes?: string[];
   returnType?: string;
};

function matchesFilter(
   item: CodeItem,
   filters: Filters,
): boolean {

   if (
      filters.kind !== undefined &&
      item.kind !== filters.kind
   ) {
      return false;
   }

   if (
      filters.parameterCount !== undefined &&
      item.parameters.length !== filters.parameterCount
   ) {
      return false;
   }

   if (filters.parameterTypes !== undefined) {
      const types = item.parameters.map(p => p.type);

      if (
         types.length !== filters.parameterTypes.length
      ) {
         return false;
      }

      for (let i = 0; i < types.length; i++) {
         if (types[i] !== filters.parameterTypes[i]) {
            return false;
         }
      }
   }

   if (
      filters.returnType !== undefined &&
      item.returnType !== filters.returnType
   ) {
      return false;
   }

   return true;
}


// --------------------------------------------------
// 6. Hybrid search
// --------------------------------------------------

async function search(
   query: string,
   filters: Filters = {},
) {
   // Embed the user's query.

   const queryEmbedding =
      await context.getEmbeddingFor(query);


   // First perform structural filtering.

   const candidates = index.filter(item =>
      matchesFilter(item, filters),
   );


   // Then semantic ranking.

   const results = candidates
      .map(item => ({
         item,

         similarity: cosineSimilarity(
            queryEmbedding.vector,
            item.embedding,
         ),
      }))
      .sort(
         (a, b) =>
            b.similarity - a.similarity,
      );


   return results;
}


// --------------------------------------------------
// 7. Try some searches
// --------------------------------------------------

console.log("\n==============================");
console.log("SEARCH 1");
console.log("==============================");

let results = await search(
   "function that adds two numbers",
);

for (const result of results) {
   console.log(
      result.similarity.toFixed(4),
      result.item.name,
   );
}


console.log("\n==============================");
console.log("SEARCH 2");
console.log("==============================");

results = await search(
   "function that takes no arguments",
   {
      parameterCount: 0,
   },
);

for (const result of results) {
   console.log(
      result.similarity.toFixed(4),
      result.item.name,
   );
}


console.log("\n==============================");
console.log("SEARCH 3");
console.log("==============================");

results = await search(
   "function that returns text",
   {
      returnType: "string",
   },
);

for (const result of results) {
   console.log(
      result.similarity.toFixed(4),
      result.item.name,
   );
}


console.log("\n==============================");
console.log("SEARCH 4");
console.log("==============================");

results = await search(
   "function that performs arithmetic on two numbers",
   {
      parameterCount: 2,
      parameterTypes: ["number", "number"],
      returnType: "number",
   },
);

for (const result of results) {
   console.log(
      result.similarity.toFixed(4),
      result.item.name,
   );
}
const parser = new Parser();
parser.setLanguage(cpp);

const buffer = Buffer.alloc(15655);
const readBytes = await readFile("/home/abhirup/Projects/algo-visualizer/src/utils.cpp", buffer, buffer.length);

console.log(readBytes);
// console.log(buffer.toString());

const tree = parser.parse(buffer.toString());
console.log(tree.rootNode?.child(2)?.type, tree.rootNode?.child(2)?.grammarType, tree.rootNode?.child(2)?.fields);
// console.log(tree.rootNode?.type, tree.rootNode.text);

async function readFile(filepath: string, buffer: Buffer, bufSize: number): Promise<number> {
   let bytesRead: number = 0;
   let file: FileSystemFileHandle;
   try {
      file = await open(filepath);
      bytesRead = (await file.read({ buffer, length: bufSize })).bytesRead;

   } catch (err) {
      console.log(err);
   } finally {
      await file.close();
      return bytesRead;
   }
}


// const db = initDB();
// const usersTable = pgTable("users", {
//
//    id: integer().primaryKey().generatedAlwaysAsIdentity(),
//    name: varchar({ length: 255 }).notNull()
// });
