import { getColumns } from "drizzle-orm";
import crypto from "node:crypto";
import initDB from ".";
import { CodeItem, IndexedCodeItem } from "../types";
import ParseDotEnv from "../utils";
import { chunk, ChunkInsert, codebase } from "./schemas/codebase";
import createEncoderService from "../services/sbert-encoder.service";
import { getLlama } from "node-llama-cpp";
import { users } from "./schemas/users";


Object.assign(process.env, await ParseDotEnv());

const main = async () => {

  const llama = await getLlama();
  const sbertServiceInstance = await createEncoderService(llama);

  const db = initDB();

  // console.log(getColumns(users));

  const data: CodeItem[] = [
    {
      //id: 1,
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

  const testPassword = "abc123";
  const salt = "this is a random test salt"; //crypto.randomBytes(16).toString('hex');
  let hashpasswd: string = "";
  crypto.pbkdf2(testPassword, salt, 1000, 64, 'sha512', (err, key) => {
    if (err) throw err;
    hashpasswd = key.toString('hex');
  })


  const user = await db.insert(users).values({ name: "Abhirup Bhattacharyya", type: "guest", password_hash: hashpasswd }).returning({ userId: users.id });

  const project = await db.insert(codebase).values({ authorId: user[0].userId, type: "zip", totalChunks: 1024n }).returning({ codebase_id: codebase.id });

  const embeddedData: ChunkInsert[] = await sbertServiceInstance.indexFile(data, project[0].codebase_id);
  await db.insert(chunk).values(embeddedData);
  console.log("seeding done");
};

main();
