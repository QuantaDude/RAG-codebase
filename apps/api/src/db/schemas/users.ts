import { sql } from "drizzle-orm";
import { check } from "drizzle-orm/pg-core/checks";
import { boolean, integer, pgEnum, serial, varchar } from "drizzle-orm/pg-core/columns";
import { pgTable } from "drizzle-orm/pg-core/table";

export const userRoleEnum = pgEnum("user_role", ["admin", "user", "guest", "viewer"]);


export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar({ length: 255 }).unique(),
  password_hash: varchar({ length: 255 }).notNull(),
  name: varchar({ length: 255 }).notNull(),
  type: userRoleEnum("type").default("guest").notNull(),
  verified: boolean().default(false).notNull()
}, (table) => [
  check(
    "user_email_required",
    sql`${table.type} != 'user' OR ${table.email} IS NOT NULL`,
  )
]);
