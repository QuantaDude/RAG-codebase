import Parser from "tree-sitter";
import cpp from "tree-sitter-cpp";
import javascript from "tree-sitter-javascript";
import { open } from "node:fs/promises";
import { Buffer, buffer } from "node:buffer";
import { getLlama, LlamaChatSession } from "node-llama-cpp";
import ParseDotEnv from "./utils";
import initDB from "./db";
import Express from "express";
import cors from "cors";
import { createQueryRoutes, createUserRoutes } from "./routes";
import { createDecoderService } from "./services/llm-decoder-gen.service.ts";
import createEncoderService from "./services/sbert-encoder.service.ts";

Object.assign(process.env, await ParseDotEnv());

async function main(): Promise<void> {

   const db = initDB();


   const llama = await getLlama();
   const decoderSerivce = await createDecoderService(llama);
   const encoderService = await createEncoderService(llama);

   const app = Express();

   const whitelist = ['http://localhost:5173'];
   const corsOptions = {
      origin: function (origin, callback) {
         if (whitelist.indexOf(origin) !== -1) {
            callback(null, true);
         } else {
            callback(new Error("Not allowed by CORS"));
         }
      }
   }

   app.use(cors(corsOptions));
   app.use(Express.json());

   app.use("/api", createUserRoutes());
   app.use('/api', createQueryRoutes(db, decoderSerivce, encoderService));


   app.listen(3000, () => console.log("listenting on port 3000"));
};

main();

// const parser = new Parser();
// parser.setLanguage(cpp);
//
// const buffer = Buffer.alloc(15655);
// const readBytes = await readFile("/home/abhirup/Projects/algo-visualizer/src/utils.cpp", buffer, buffer.length);
//
// console.log(readBytes);
// // console.log(buffer.toString());
//
// const tree = parser.parse(buffer.toString());
// console.log(tree.rootNode?.child(2)?.type, tree.rootNode?.child(2)?.grammarType, tree.rootNode?.child(2)?.fields);
// // console.log(tree.rootNode?.type, tree.rootNode.text);
//
// async function readFile(filepath: string, buffer: Buffer, bufSize: number): Promise<number> {
//    let bytesRead: number = 0;
//    let file: FileSystemFileHandle;
//    try {
//       file = await open(filepath);
//       bytesRead = (await file.read({ buffer, length: bufSize })).bytesRead;
//
//    } catch (err) {
//       console.log(err);
//    } finally {
//       await file.close();
//       return bytesRead;
//    }
// }
