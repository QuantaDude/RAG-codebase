import { bigint, integer, jsonb, pgEnum, serial, text, uuid, vector } from "drizzle-orm/pg-core/columns";
import { pgTable } from "drizzle-orm/pg-core/table";
import { users } from "./users";
import { index, uniqueIndex } from "drizzle-orm/pg-core/indexes";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const CODEBASE_TYPE_ENUM = pgEnum("codebase_type", ["zip", "git"]);
export const CHUNK_TYPE_ENUM = pgEnum("chunk_type",
  //C++
  ["function", "function_definition", "function_declarator", "function_declaration",
    "class", "storage_class_specifier", "access_specifier", "method", "variable"]);

export const DATA_TYPES = [
  "string",
  "number",
  "void",
  "unknown",
  "int",
  "float",
  "char",
  "object"
] as const;

export type DataType = (typeof DATA_TYPES)[number];


export const RETURN_TYPE_ENUM = pgEnum("return_type", DATA_TYPES);

export type Parameter = {
  name: string;
  type: DataType;
  optional?: boolean;
};

export const codebase = pgTable('codebases', {
  id: uuid('id').defaultRandom().primaryKey(),
  authorId: integer('author_id').notNull().references(() => users.id, {
    onDelete: 'cascade',
    onUpdate: 'no action'
  }),

  totalChunks: bigint('total_chunks', { mode: 'bigint' }).notNull(),
  type: CODEBASE_TYPE_ENUM("type").notNull()
});



export const chunk = pgTable('chunks', {
  id: uuid().defaultRandom().primaryKey(),
  file: uuid().references(() => file.id, {
    onDelete: 'cascade',
  }),
  name: text().notNull(),
  kind: CHUNK_TYPE_ENUM("type").notNull(),
  parameters: jsonb('parameters').$type<Parameter[]>(),
  returnType: RETURN_TYPE_ENUM("return_type").notNull(),
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

export const file = pgTable('files', {
  id: uuid('file_id').defaultRandom().primaryKey(),
  codebaseId: uuid('codebase_id').notNull().references(() => codebase.id, {
    onDelete: 'cascade',
    onUpdate: 'no action'
  }),
  path: text().notNull()
}, (t) => [uniqueIndex("file_path_codebase_idx").on(t.codebaseId, t.path)]);

type CodebaseInsert = typeof codebase.$inferInsert;
type CodebaseSelect = typeof codebase.$inferSelect;
type ChunkInsert = typeof chunk.$inferInsert;
type ChunkSelect = typeof chunk.$inferSelect;

// type ChunkInsert = InferInsertModel<typeof chunk>;
export type { CodebaseInsert, CodebaseSelect, ChunkInsert, ChunkSelect };
