import { defineConfig } from 'drizzle-kit';
import ParseDotEnv from './src/utils';

Object.assign(process.env, await ParseDotEnv());

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schemas/',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    ssl: false
  }
})
