import { drizzle } from "drizzle-orm/node-postgres";
function initDB() {
  const db = drizzle({
    connection: {
      host: process.env.DB_HOST!,
      port: process.env.DB_PORT!,
      user: process.env.DB_USERNAME!,
      password: process.env.DB_PASSWORD!,
      database: process.env.DB_NAME!
    }
  });

  return db;
}

export default initDB;
