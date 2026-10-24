CREATE TABLE "files" (
	"file_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"codebase_id" uuid NOT NULL,
	"path" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chunks" DROP CONSTRAINT "chunks_codebase_id_codebases_id_fkey";--> statement-breakpoint
ALTER TABLE "chunks" ADD COLUMN "file" uuid;--> statement-breakpoint
ALTER TABLE "chunks" DROP COLUMN "codebase_id";--> statement-breakpoint
ALTER TABLE "codebases" ALTER COLUMN "author_id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE "codebases_author_id_seq";--> statement-breakpoint
ALTER TABLE "codebases" ALTER COLUMN "author_id" SET DATA TYPE integer USING "author_id"::integer;--> statement-breakpoint
CREATE UNIQUE INDEX "file_path_codebase_idx" ON "files" ("codebase_id","path");--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_file_files_file_id_fkey" FOREIGN KEY ("file") REFERENCES "files"("file_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_codebase_id_codebases_id_fkey" FOREIGN KEY ("codebase_id") REFERENCES "codebases"("id") ON DELETE CASCADE;