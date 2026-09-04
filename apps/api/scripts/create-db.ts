import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const database = "rag_app";

async function main() {
  try {
    await execFileAsync("createdb", [database]);
    console.log(`✓ Database "${database}" created`);
  } catch (error: any) {
    // PostgreSQL returns an error if it already exists.
    if (!error.stderr?.includes("already exists")) {
      throw error;
    }

    console.log(`✓ Database "${database}" already exists`);
  }

  await execFileAsync(
    "psql",
    [
      database,
      "-c",
      "CREATE EXTENSION IF NOT EXISTS vector;",
    ],
  );

  console.log("✓ pgvector extension enabled");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
