CREATE SEQUENCE "codebases_author_id_seq";--> statement-breakpoint
ALTER TABLE "codebases" ALTER COLUMN "author_id" SET DEFAULT nextval('codebases_author_id_seq')--> statement-breakpoint
ALTER SEQUENCE "codebases_author_id_seq" OWNED BY "public"."codebases"."author_id";--> statement-breakpoint
ALTER TABLE "codebases" ALTER COLUMN "author_id" SET DATA TYPE int USING "author_id"::int;