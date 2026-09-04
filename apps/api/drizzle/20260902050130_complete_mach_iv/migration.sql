CREATE TYPE "user_role" AS ENUM('admin', 'user', 'guest', 'viewer');--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY,
	"email" varchar(255) UNIQUE,
	"password_hash" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "user_role" DEFAULT 'guest'::"user_role" NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	CONSTRAINT "user_email_required" CHECK ("type" != 'user' OR "email" IS NOT NULL)
);
