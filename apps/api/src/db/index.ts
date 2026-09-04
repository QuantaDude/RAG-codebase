import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import 'dotenv/config';

function initDB(): NodePgDatabase {
  const db = drizzle({
    connection: {
      host: process.env.DB_HOST!,
      port: process.env.DB_PORT!,
      user: process.env.DB_USERNAME!,
      password: process.env.DB_PASSWORD!,
    }
  });

  return db;
}

export default initDB;
