CREATE TYPE "return_type" AS ENUM('string', 'number', 'void', 'unknown', 'int', 'float', 'char');--> statement-breakpoint
CREATE TYPE "chunk_type" AS ENUM('function', 'function_definition', 'function_declarator', 'function_declaration', 'class', 'storage_class_specifier', 'access_specifier', 'method', 'variable');--> statement-breakpoint
CREATE TYPE "codebase_type" AS ENUM('zip', 'git');--> statement-breakpoint
CREATE TABLE "chunks" (
	"id" uuid PRIMARY KEY,
	"codebase_id" uuid,
	"name" text NOT NULL,
	"type" "chunk_type" NOT NULL,
	"parameters" jsonb,
	"return_type" "return_type" NOT NULL,
	"code" text NOT NULL,
	"embedding" vector(896) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "codebases" (
	"id" uuid PRIMARY KEY,
	"author_id" integer NOT NULL,
	"total_chunks" bigint NOT NULL,
	"type" "codebase_type" NOT NULL
);
--> statement-breakpoint
CREATE INDEX "hnsw_idx" ON "chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_codebase_id_codebases_id_fkey" FOREIGN KEY ("codebase_id") REFERENCES "codebases"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "codebases" ADD CONSTRAINT "codebases_author_id_users_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE;