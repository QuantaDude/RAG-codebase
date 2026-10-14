import Stream from "node:stream";
import fs from "node:fs";
import cpp from "tree-sitter-cpp";
import typescript from "tree-sitter-typescript";
import javascript from "tree-sitter-javascript";
import yz from "yauzl";
import Parser, { SyntaxNode } from "tree-sitter";
import { ChunkInsert } from "../db/schemas/codebase";

export type IndexingService = {
  readZipFile: (file: Buffer) => void;
};

type File = {
  directory: string;
  fileName: string;
  content: string;
};

type Function = Omit<ChunkInsert, 'embedding'>;

type Allowed = '.h' | '.hpp' | '.cpp' | '.c' | '.ts' | '.js' | '.tsx' | '.jsx';
const allowed: string[] = ['.h', '.hpp', '.cpp', '.c', '.ts', '.tsx', '.js', '.jsx'];
const allowedDirs: string[] = ['/src/', '/include/'];


export function CreateCodeIndexingService() {

  async function readZipFile(file: Buffer): Promise<File[]> {
    let currentDir: string = '';
    const files: File[] = [];

    const result = await yz.fromBufferPromise(file, { lazyEntries: true });
    console.log(result.fileSize);
    for await (let entry of result.eachEntry()) {
      const readStream = await result.openReadStreamPromise(entry);

      currentDir = entry.fileName;
      console.log(currentDir.slice(currentDir.lastIndexOf('/'), currentDir.length));
      if (allowed.includes(entry.fileName.slice(currentDir.lastIndexOf('.'), currentDir.length))) {
        console.log("directory:", entry.fileName);
        readStream.on("data", (data) => {
          files.push({
            directory: currentDir.slice(0, currentDir.lastIndexOf('/') + 1),
            fileName: currentDir.slice(currentDir.lastIndexOf('/') + 1, currentDir.length),
            content: data.toString()
          });
        });
      }

      readStream.on("end", () => { console.log("=======\n=====\n========\nnew file:\n") });
    }

    result.once("end", () => {
      console.log("END OF ZIP FILE.");
      result.close();
    });

    return files;
  }

  async function chunkFunctions(files: File[]) {

    const parser = new Parser();

    for (const file of files) {
      const file_extension = file.fileName.slice(file.fileName.lastIndexOf('.'), file.fileName.length);

      if (['.cpp', '.c', '.h', '.hpp'].includes(file_extension)) {

        parser.setLanguage(cpp);
      } else if (file_extension == '.ts') {

        parser.setLanguage(typescript.typescript);
      } else if (file_extension == '.tsx') {

        parser.setLanguage(typescript.tsx);
      } else if (file_extension == '.js') {

        parser.setLanguage(javascript);
      }

      const tree: Parser.Tree = parser.parse(file.content);
      const root = tree.rootNode;

      // for (root.childWithDescendant) {
      //
      // }
    }

  }
  async function Traverse_Tree(node: SyntaxNode, functions: Function[]) {

    if (['function_definition', 'function_declaration'].includes(node.type)) {

      functions.push({ code: node.text, kind: 'function', name: node.childForFieldName("name"), parameters: node.childForFieldName("parameters") })
    }

    for (const child of node.namedChildren) {
      Traverse_Tree(child, functions);
    }
  }

  return {
    readZipFile
  } satisfies IndexingService;
}
