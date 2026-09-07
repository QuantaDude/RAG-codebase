ALTER TABLE "chunks" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "codebases" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();