import { LlamaModel } from "node-llama-cpp";
import { DecoderService } from "./llm-decoder-gen.service";
import { EncoderService } from "./sbert-encoder.service";
import { NodePgClient, NodePgDatabase } from "drizzle-orm/node-postgres";
import { chunk, dataTypes, Parameter } from "../db/schemas/codebase";
import { and, eq, or, sql, cosineDistance } from "drizzle-orm";
import { QueryResponse } from "@RAG-codebase/types";


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
  "parameters": Parameter[],
  "returnType": string
}

Where:

Parameter = {
  "name": string,
  "type": DataType,
  "optional"?: boolean
}

DataType =
  "number" | "string" | "boolean" | "object" | "array" | "function" | "unknown"

Each entry in "parameters" describes ONE parameter, in positional order
(the first entry is the first parameter, the second entry is the second
parameter, etc).

- "name" is the parameter's identifier. Use "" when the name is not
  explicitly known.
- "type" is the parameter's normalized type. Use "unknown" when the type
  is not explicitly known.
- "optional" is true ONLY when the user explicitly says that parameter
  is optional. Omit it entirely otherwise (never set it to false).

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

   Do NOT derive this number by counting how many "parameters" entries
   you ended up with, by counting pronouns that refer back to an
   already-introduced parameter, or by counting the actions/verbs the
   query describes. If no count is explicitly stated, omit
   "parameterCount" entirely — even when exactly one parameter's name
   or type was extracted.

3. "parameters"

Each parameter is represented as an object with "name", "type", and
optionally "optional". Only include a parameter entry, or fill in a
field on one, when the user explicitly provides that information.

A parameter entry is added to the array ONLY when the query
introduces that parameter — by giving it a name, a type, an explicit
position, or as part of an explicit list/count of parameters. Do NOT
add an entry for a pronoun that refers back to an already-introduced
parameter (e.g. "it", "that value", "the same one"), and do NOT add
one for a phrase describing what the function DOES with a parameter
(e.g. "prints it", "logs it", "returns it", "sends it to the
server"). Those describe behavior, not a new parameter.

Example:

"takes a string named message and then prints it to the console"
->
{
  "kind": "function",
  "parameters": [
    { "name": "message", "type": "string" }
  ]
}

It MUST NOT produce:
{
  "kind": "function",
  "parameterCount": 2,
  "parameters": [
    { "name": "message", "type": "string" },
    { "name": "", "type": "unknown" }
  ]
}

"prints it to the console" describes what the function does with
"message" — "it" refers back to "message", not to a new, second
parameter, so no second entry is added and "parameterCount" is
omitted (it was never explicitly stated).

3a. "name"

A parameter name is the LITERAL identifier used in source code.

Set "name" ONLY when the user explicitly provides the literal
identifier. Otherwise use "".

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

These descriptions MUST NOT be converted into names.

For example:

"accepts a user ID"
->
parameters: []

"accepts a configuration object"
->
parameters: []

"accepts a user ID and a configuration object"
->
parameters: []

"accepts a parameter named userId"
->
parameters: [{ "name": "userId", "type": "unknown" }]

"accepts an argument called userId"
->
parameters: [{ "name": "userId", "type": "unknown" }]

"the first parameter is userId"
->
parameters: [{ "name": "userId", "type": "unknown" }]

"the second parameter is named config"
->
parameters: [{ "name": "", "type": "unknown" }, { "name": "config", "type": "unknown" }]

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
parameters: []

It MUST NOT produce:
parameters: [{ "name": "userId", "type": "unknown" }]

"takes a configuration object"
MUST produce:
parameters: []

It MUST NOT produce:
parameters: [{ "name": "config", "type": "unknown" }]

"takes a username"
MUST produce:
parameters: []

It MUST NOT produce:
parameters: [{ "name": "username", "type": "unknown" }]

This still applies when the query ALSO states the parameter's type.
Extracting a type never licenses extracting a name from the same
description — the two are independent, and a description stays a
description no matter what is said about its type.

"takes a numeric user id"
MUST produce:
parameters: [{ "name": "", "type": "number" }]

It MUST NOT produce:
parameters: [{ "name": "userId", "type": "number" }]

"takes a string username"
MUST produce:
parameters: [{ "name": "", "type": "string" }]

It MUST NOT produce:
parameters: [{ "name": "username", "type": "string" }]

Even if a description happens to look like a common variable name,
it is still a description unless the user explicitly identifies it
as a source-code parameter name.

For example:

"takes a username and password"
->
parameters: []

NOT:
parameters: [{ "name": "username", "type": "unknown" }, { "name": "password", "type": "unknown" }]

However:

"takes parameters named username and password"
->
parameters: [{ "name": "username", "type": "unknown" }, { "name": "password", "type": "unknown" }]

Parameter names are positional.

If the user explicitly identifies the position of a parameter,
preserve that position.

Example:

"first parameter is named userId"
->
parameters: [{ "name": "userId", "type": "unknown" }]

Example:

"second parameter is named config"
->
parameters: [{ "name": "", "type": "unknown" }, { "name": "config", "type": "unknown" }]

If the user explicitly provides multiple parameter names and their
order is clear:

"parameters named userId and config, in that order"
->
parameters: [{ "name": "userId", "type": "unknown" }, { "name": "config", "type": "unknown" }]

If the order cannot be determined, do NOT guess.

Example:

"parameters named userId and config"
->
parameters: []

If only some parameter names are explicitly known and their
positions are known, preserve the positions and use "" for unknown
positions.

NEVER invent a missing parameter name.
NEVER infer a parameter name from its meaning.
NEVER infer a parameter name from its type.
NEVER infer a parameter name from common programming conventions.
NEVER promote a description into a name just because a type was
also extracted for that same parameter.
NEVER add a parameter entry for a pronoun or restated reference to
an already-introduced parameter.

3b. "type"

Extract "type" ONLY when the user explicitly specifies it. Otherwise
use "unknown".

The ordering matters.

The first entry describes the first parameter.
The second entry describes the second parameter.
The third entry describes the third parameter, etc.

Examples:

"takes two numbers"
->
parameters: [{ "name": "", "type": "number" }, { "name": "", "type": "number" }]

"accepts a string and a number"
->
parameters: [{ "name": "", "type": "string" }, { "name": "", "type": "number" }]

"takes a boolean"
->
parameters: [{ "name": "", "type": "boolean" }]

"takes a string followed by a number"
->
parameters: [{ "name": "", "type": "string" }, { "name": "", "type": "number" }]

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
parameters: [{ "name": "age", "type": "unknown" }]

Do NOT assume:
parameters: [{ "name": "age", "type": "number" }]

3c. "optional"

Set "optional": true on a parameter entry ONLY when the user
explicitly states that specific parameter is optional. Omit the
field entirely otherwise — never set it to false.

Example:

"takes an optional parameter named config"
->
parameters: [{ "name": "config", "type": "unknown", "optional": true }]

Example:

"takes a number and an optional boolean"
->
parameters: [{ "name": "", "type": "number" }, { "name": "", "type": "boolean", "optional": true }]

NEVER infer "optional" from a parameter's name, type, or position.
NEVER infer it just because a parameter is mentioned after others.

4. "returnType"
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

5. Relationship between parameters and parameterCount

   These fields are independent.

   Only include information that the user explicitly provides.

   Do NOT fill in missing information using assumptions.

   Example:

   "find functions that take two numbers"

   ->
   {
     "kind": "function",
     "parameterCount": 2,
     "parameters": [
       { "name": "", "type": "number" },
       { "name": "", "type": "number" }
     ]
   }

   Example:

   "find functions that take two parameters named 'a' and 'b'"

   ->
   {
     "kind": "function",
     "parameterCount": 2,
     "parameters": [
       { "name": "a", "type": "unknown" },
       { "name": "b", "type": "unknown" }
     ]
   }

   Example:

   "find functions that take a parameter named 'a' and a number"

   If the query does not make the positional order unambiguous,
   do not guess the order.

   ->
   {
     "kind": "function",
     "parameters": []
   }

6. Do NOT infer structural information from semantic descriptions.

   Example:

   "function that calculates the average"
   ->
   {}

   Do NOT assume it takes numbers.

7. Keep semantic information OUT of the JSON.

   Example:

   "function that takes two numbers and calculates their sum"

   ->
   {
     "kind": "function",
     "parameterCount": 2,
     "parameters": [
       { "name": "", "type": "number" },
       { "name": "", "type": "number" }
     ]
   }

   The phrase "calculates their sum" is semantic information.
   It must NOT appear in the JSON.

   Example:

   "function that takes a string named message and logs it to the console"

   ->
   {
     "kind": "function",
     "parameters": [
       { "name": "message", "type": "string" }
     ]
   }

   "logs it to the console" describes behavior. It must NOT be
   treated as a second parameter, must NOT affect "parameterCount",
   and must NOT appear in the JSON.

8. If the query contains no structural constraints, return:

   {}

9. Never add fields that aren't explicitly supported by the schema.

10. Never use null.

11. Never invent parameter names.

12. Never invent parameter types.

13. Never invent an "optional" flag.

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
  "parameters": [
    { "name": "", "type": "number" },
    { "name": "", "type": "number" }
  ],
  "returnType": "void"
}

User query:
"find functions with no arguments"

Output:
{
  "kind": "function",
  "parameterCount": 0,
  "parameters": []
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
  "parameters": [
    { "name": "", "type": "string" },
    { "name": "", "type": "boolean" }
  ]
}

User query:
"find functions with a parameter named 'userId'"

Output:
{
  "kind": "function",
  "parameters": [
    { "name": "userId", "type": "unknown" }
  ]
}

User query:
"find functions with parameters named 'userId' and 'includeDeleted'"

Output:
{
  "kind": "function",
  "parameterCount": 2,
  "parameters": [
    { "name": "userId", "type": "unknown" },
    { "name": "includeDeleted", "type": "unknown" }
  ]
}

User query:
"find functions with a parameter called 'userId' and a boolean"

Output:
{
  "kind": "function",
  "parameters": []
}

User query:
"find functions that take a parameter called 'userId' followed by a boolean"

Output:
{
  "kind": "function",
  "parameterCount": 2,
  "parameters": [
    { "name": "userId", "type": "unknown" },
    { "name": "", "type": "boolean" }
  ]
}

User query:
"find functions that take an optional parameter named 'limit'"

Output:
{
  "kind": "function",
  "parameters": [
    { "name": "limit", "type": "unknown", "optional": true }
  ]
}

User query:
"can you find the function which retrieves the username? the function takes in a numeric user id."

Output:
{
  "kind": "function",
  "parameterCount": 1,
  "parameters": [
    { "name": "", "type": "number" }
  ]
}

"user id" is a description, not a literal identifier, so "name" stays
"". Extracting "type": "number" from "numeric" does NOT justify also
writing "name": "userId" — that would be an invented identifier.

User query:
"I want the function which takes in a string named message and then the function prints it to the console. it logs it."

Output:
{
  "kind": "function",
  "parameters": [
    { "name": "message", "type": "string" }
  ]
}

Only one parameter was introduced: a string named "message". "prints
it to the console" and "it logs it" describe what the function does
with "message" — "it" refers back to "message" both times, not to a
second parameter. No second entry is added, and "parameterCount" is
omitted since no count was ever explicitly stated.

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
  "parameters": [
    { "name": "", "type": "number" },
    { "name": "", "type": "number" }
  ]
}

Now parse this user query:

`;

export type QueryService = {

  // getFilter: (query: string) => Promise<string>;
  search: (query: string) => Promise<string>;
};
export default function createQueryService(qwenInstance: DecoderService, sbertInstance: EncoderService,
  database: NodePgDatabase & { $client: NodePgClient }) {

  async function getFilter(query: string): Promise<Object> {
    const { context, session } = await qwenInstance.createChatContext();

    const result = await session.prompt(filterPrompt + query);
    //validate first
    //
    context.dispose();
    return JSON.parse(result);
  }

  async function search(query: string): Promise<QueryResponse> {

    const filters = await getFilter(query);
    console.log(filters);
    const queryVector = (await sbertInstance.encodeQuery(query)).vector;
    const vectors = `[${queryVector.join(",")}]`;
    const similarity = sql<number>`1 - (${cosineDistance(chunk.embedding, vectors)})`.as("similarity");

    // const result = await database.select().from(chunk).where(or(eq(chunk.kind, kind), eq(chunk.returnType, returnType ?? dataTypes)));
    const results = await database
      .select({
        id: chunk.id,
        content: chunk.code,

        similarity: similarity
      })
      .from(chunk)
      .where(and(eq(chunk.kind, filters['kind']),
        filters["parameterCount"] ? sql`jsonb_array_length(${chunk.parameters}) = ${filters["parameterCount"]}` : undefined,
        filters["returnType"] && filters["returnType"] != "" ? eq(chunk.returnType, filters["returnType"]) : undefined
      )
      )
      .orderBy(cosineDistance(chunk.embedding, vectors))
      .limit(10);

    console.log(results[0].content);
    return {
      message: results[0].content
    };
  }
  return {
    search
  } satisfies QueryService;

}
