import Stream from "node:stream";
import fs from "node:fs";
import cpp from "tree-sitter-cpp";
import typescript from "tree-sitter-typescript";
import javascript from "tree-sitter-javascript";
import yz from "yauzl";
import Parser, { SyntaxNode } from "tree-sitter";
import { ChunkInsert, DataType, DATA_TYPES, Parameter, chunk, file, codebase } from "../db/schemas/codebase";
import { NodePgDatabase, NodePgClient } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";

export type IndexingService = {
  Create_New_Workspace: (file: Buffer) => void;
};

type File = {
  directory: string;
  fileName: string;
  content: string;
};

type Function = ChunkInsert;

type Allowed = '.h' | '.hpp' | '.cpp' | '.c' | '.ts' | '.js' | '.tsx' | '.jsx';
const allowed: string[] = [ '.h', '.hpp', '.cpp', '.c', '.ts', '.tsx', '.js',
                          '.jsx' ];
const allowedDirs: string[] = ['/src/', '/include/'];

const NAME_TYPES = new Set ( [
                              'identifier', 'field_identifier',
                              'qualified_identifier', 'destructor_name',
                              'operator_name', 'template_function'
                            ] );

const PARAM_TYPES = new Set( [
                              'parameter_declaration',
                              'optional_parameter_declaration',
                              'variadic_parameter_declaration',
                             ] );


export function
CreateCodeIndexingService(database: NodePgDatabase & { $client: NodePgClient })
{

  async function
  Create_New_Workspace (zip: Buffer)
  {
    const [cb] = await database.insert(codebase)
      .values({ authorId: 1, totalChunks: BigInt(0), type: 'zip' })
      .returning({ id: codebase.id });
  
    const source_files = await Read_ZipFile(zip);
    const chunks = await Create_Function_Chunks(source_files, cb.id);
  
    await Write_Chunks(cb.id, chunks);
  }

  async function
  Write_Chunks (codebase_id: string, chunks: ChunkInsert[])
  {
    if (chunks.length === 0) return;
    await database.insert(chunk).values(chunks);
    await database.update(codebase)
      .set({ totalChunks: BigInt(chunks.length) })
      .where(eq(codebase.id, codebase_id));
  }
  async function
  Read_ZipFile (zip: Buffer): Promise<File[]>
  {
    const files: File[] = [];
    const result = await yz.fromBufferPromise(zip, { lazyEntries: true });
  
    for await (const entry of result.eachEntry()) {
      if (entry.fileName.endsWith('/')) continue;                 // directory entry
  
      const ext = entry.fileName.slice(entry.fileName.lastIndexOf('.'));
      if (!allowed.includes(ext)) continue;
  
      const readStream = await result.openReadStreamPromise(entry);
      const parts: Buffer[] = [];
      for await (const part of readStream) parts.push(part as Buffer);  // wait for the whole file
  
      const slash = entry.fileName.lastIndexOf('/') + 1;
      files.push({
        directory: entry.fileName.slice(0, slash),
        fileName : entry.fileName.slice(slash),
        content  : Buffer.concat(parts).toString('utf8'),
      });
    }
  
    result.close();
    return files;
  }


  async function
  Create_Function_Chunks (files: File[], codebase_id: string)
  {
    const parser = new Parser();
    const chunks: ChunkInsert[] = [];
  
    for (const f of files) {
      const ext = f.fileName.slice(f.fileName.lastIndexOf('.'));
  
      if (['.cpp', '.c', '.h', '.hpp'].includes(ext)) parser.setLanguage(cpp);
      else if (ext === '.ts')                         parser.setLanguage(typescript.typescript);
      else if (ext === '.tsx')                        parser.setLanguage(typescript.tsx);
      else if (ext === '.js' || ext === '.jsx')       parser.setLanguage(javascript);
      else continue;
  
      const [inserted] = await database.insert(file).values({
        codebaseId: codebase_id,
        path: f.directory + f.fileName,
      }).returning();
  
      const functions: Function[] = [];                  // per file
      Traverse_SourceTree(parser.parse(f.content).rootNode, functions);
  
      for (const func of functions) {
        chunks.push({ ...func, file: inserted.id });     // keeps parameters too
      }
    }
  
    return chunks;                                       // not `functions`
  }

  function
  Declarator_Name (d: SyntaxNode | null): string | undefined
  {
    while (d) {
      if (NAME_TYPES.has(d.type)) return d.text;

      d = d.childForFieldName('declarator') ?? d.firstNamedChild;
    }
    return undefined;
  }

  function
  Find_Function_Declarator (d: SyntaxNode | null): SyntaxNode | null
  {
    while (d && d.type !== 'function_declarator') {
      d = d.childForFieldName('declarator') ?? d.firstNamedChild;
    }
    return d;
  }

  function
  Find_Function_Parameters(fn_declarator: SyntaxNode) : Parameter[]
  {
    const list = fn_declarator.childForFieldName("parameters");
    if (!list) return [];
    return (
            list.namedChildren
            .filter(p => PARAM_TYPES.has(p.type))
            .map( p => ({
                      name: Declarator_Name(p.childForFieldName('declarator')),
                      type: DATA_TYPES.
                            includes(p.childForFieldName('type')?.text as DataType)
                            ? p.childForFieldName('type')?.text : 'unknown',
                      optional: false
                      } as Parameter)
                )
          );

  }

  function
  Find_Function_Return_Type(fn_definition: SyntaxNode, fd : SyntaxNode)
  {
    const base = fn_definition.childForFieldName('type')?.text;
    const fn_declarator = fn_definition.childForFieldName('declarator')!;
    const indirection = fn_declarator.id === fd.id
      ? ''
      : fn_declarator?.text.slice(0, fd.startIndex
                                    - fn_declarator.startIndex)
                                    .replace(/\s+/g, '');

    const trailing = fd.namedChildren
      .find(c => c.type === 'trailing_return_type')
      ?.namedChildren.find(c => c.type === 'type_descriptor')?.text;

    return trailing ?? (base ? base + indirection : undefined);
  }

  function
  Traverse_SourceTree(node: SyntaxNode, functions: Function[])
  {

    if ('function_definition' == node.type) {

      const fd = Find_Function_Declarator(node.childForFieldName('declarator'));
      if (fd) {
        functions.push( {
                          code      : node.text,
                          kind      : 'function',
                          name      : Declarator_Name(fd.childForFieldName('declarator')) ?? "",
                          parameters: Find_Function_Parameters(fd),
                          returnType: Find_Function_Return_Type(node, fd) as DataType,
                          embedding: []
                        }
                      );
      }
    }

    for (const child of node.namedChildren) {
      Traverse_SourceTree(child, functions);
    }
  }

  return {
   Create_New_Workspace
  } satisfies IndexingService;
}
