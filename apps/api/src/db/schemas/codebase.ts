import { bigint, integer, jsonb, pgEnum, text, uuid, vector } from "drizzle-orm/pg-core/columns";
import { pgTable } from "drizzle-orm/pg-core/table";
import { users } from "./users";
import { index } from "drizzle-orm/pg-core/indexes";

export const codebaseTypeEnum = pgEnum("codebase_type", ["zip", "git"]);
export const chunkTypeEnum = pgEnum("chunk_type",
  //C++
  ["function", "function_definition", "function_declarator", "function_declaration",
    "class", "storage_class_specifier", "access_specifier", "method", "variable"]);

export const dataTypes = [
  "string",
  "number",
  "void",
  "unknown",
  "int",
  "float",
  "char",
] as const;

export type DataType = (typeof dataTypes)[number];


export const ReturnTypeEnum = pgEnum("return_type", dataTypes);

export type Parameter = {
  name: string;
  type: DataType;
  optional?: boolean;
};

export const codebase = pgTable('codebases', {
  id: uuid('id').primaryKey(),
  authorId: integer('author_id').notNull().references(() => users.id, {
    onDelete: 'cascade',
    onUpdate: 'no action'
  }),

  totalChunks: bigint('total_chunks', { mode: 'bigint' }).notNull(),
  type: codebaseTypeEnum("type").notNull()
});



export const chunk = pgTable('chunks', {
  id: uuid().primaryKey(),
  codebaseId: uuid('codebase_id').references(() => codebase.id, {
    onDelete: 'cascade',
    onUpdate: 'no action'
  }),

  name: text().notNull(),
  kind: chunkTypeEnum("type").notNull(),
  parameters: jsonb('parameters').$type<Parameter[]>(),
  returnType: ReturnTypeEnum("return_type").notNull(),
  code: text('code').notNull(),

  embedding: vector("embedding", { dimensions: 896 }).notNull()
},
  (t) => ({
    hnsw: index("hnsw_idx")
      .using(
        "hnsw",
        t.embedding.op("vector_cosine_ops")
      ),
  })

);
