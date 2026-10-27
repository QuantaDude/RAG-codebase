import Stream from "node:stream";
import fs from "node:fs";
import cpp from "tree-sitter-cpp";
import typescript from "tree-sitter-typescript";
import javascript from "tree-sitter-javascript";
import yz from "yauzl";
import Parser, { SyntaxNode } from "tree-sitter";
import { ChunkInsert, DataType, DATA_TYPES, Parameter, chunk, codebase, file, file, codebase } from "../db/schemas/codebase";
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

type Function = Omit<ChunkInsert, 'embedding'>;

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
  Create_New_Workspace (file: Buffer)
  {
    const s_codebase = await database.select({ id: codebase.id })
                        .from(codebase).where(eq(codebase.authorId,1));

    const source_files = await Read_ZipFile(file);
    const function_chunks = await Create_Function_Chunks(source_files, s_codebase[0]);

  }

  async function
  Write_Chunks(functions: Function[])
  {
    database.insert(codebase).values({ authorId: 1, totalChunks: BigInt(functions.length) , type: 'zip' });
    database.insert(chunk).values(functions);
  }
  async function
  Read_ZipFile ( file: Buffer ) : Promise<File[]>
  {
    let currentDir: string = '';
    const files: File[] = [];

    const result = await yz.fromBufferPromise(file, { lazyEntries: true });

    for await (let entry of result.eachEntry()) {
      const readStream = await result.openReadStreamPromise(entry);

      currentDir = entry.fileName;
      if (allowed.includes(
          entry.fileName.slice(currentDir.lastIndexOf('.')
            ,
          currentDir.length))
      ) {

        readStream.on("data", (data) => {
          files.push({
            directory : currentDir.slice(0, currentDir.lastIndexOf('/') + 1),
            fileName  : currentDir.slice(currentDir.lastIndexOf('/') + 1,
                        currentDir.length),

            content   : data.toString()
          });
        });
      }

    }

    result.once("end", () => {
      console.log("END OF ZIP FILE.");
      result.close();
    });

    return files;
  }

  async function
  Create_Function_Chunks (files: File[], codebase_id: string)
  {

    const parser = new Parser();


    for (const f of files) {

      const file_extension = f.fileName.slice(f.fileName.lastIndexOf('.'),
                             f.fileName.length);

      if (['.cpp', '.c', '.h', '.hpp'].includes(file_extension)) {

        parser.setLanguage(cpp);
      } else if (file_extension == '.ts') {

        parser.setLanguage(typescript.typescript);
      } else if (file_extension == '.tsx') {

        parser.setLanguage(typescript.tsx);
      } else if (file_extension == '.js') {

        parser.setLanguage(javascript);
      }

      const tree: Parser.Tree = parser.parse(f.content);
      const root = tree.rootNode;

      const functions: Function[] = [];
      const chunks: ChunkInsert[] = [];
      Traverse_SourceTree(root, functions);
      for (const func of functions){
        console.log(func.parameters);
        const insert_file = await database.insert(file).values({
          codebaseId: codebase_id,
          path: f.directory + f.fileName
        })
        .returning();

        const chunk: ChunkInsert = {
          name: func.name,
          kind: func.kind,
          code: func.code,
          returnType: func.returnType,
          embedding: [],
          file: insert_file[0].id,
        };
      }
      return functions;
      // for (root.childWithDescendant) {
      //
      // }
    }

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

  async function
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
                          returnType: Find_Function_Return_Type(node, fd) as DataType
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
