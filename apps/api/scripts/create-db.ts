import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ParseDotEnv from "../src/utils";

const execFileAsync = promisify(execFile);

Object.assign(process.env, await ParseDotEnv());

const database = process.env.DB_NAME!;
const username = process.env.DB_USERNAME!;
const password = process.env.DB_PASSWORD!;

if (!database || !username || !password) {
  throw new Error(
    "DB_NAME, DB_USERNAME, and DB_PASSWORD are required",
  );
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

async function psql(databaseName: string, sql: string) {
  return execFileAsync(
    "sudo",
    [
      "-n",
      "-u", "postgres",
      "psql",
      "-X",
      "-v", "ON_ERROR_STOP=1",
      "-d", databaseName,
      "-c", sql,
    ],
  );
}

async function main() {
  const role = quoteIdentifier(username);
  const rolePassword = quoteLiteral(password);
  const db = quoteIdentifier(database);

  // Create the role if missing, or update its password if it exists.
  await psql(
    "postgres",
    `DO $$
    BEGIN
    IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles
      WHERE rolname = ${quoteLiteral(username)}
    ) THEN
    CREATE ROLE ${role} WITH LOGIN PASSWORD ${rolePassword};
    ELSE
    ALTER ROLE ${role} WITH LOGIN PASSWORD ${rolePassword};
    END IF;
    END
    $$;`,
  );

  console.log(`✓ Role "${username}" is ready`);

  // Create the database if it does not exist.
  const result = await psql(
    "postgres",
    `SELECT 'exists'
  FROM pg_catalog.pg_database
  WHERE datname = ${quoteLiteral(database)};`,
  );

  if (!result.stdout.trim()) {
    await psql(
      "postgres",
      `CREATE DATABASE ${db} OWNER ${role};`,
    );
    console.log(`✓ Database "${database}" created`);
  } else {
    await psql(
      "postgres",
      `ALTER DATABASE ${db} OWNER TO ${role};`,
    );
    console.log(`✓ Database "${database}" already exists`);
  }

  // Enable pgvector in the application database.
  await psql(
    database,
    "CREATE EXTENSION IF NOT EXISTS vector;",
  );

  console.log("✓ pgvector extension enabled");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

