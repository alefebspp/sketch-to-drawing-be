import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Connection for runtime usage. Migrations are driven by `drizzle.config.ts`.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool);

