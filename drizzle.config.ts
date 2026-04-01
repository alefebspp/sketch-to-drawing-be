import "dotenv/config";
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/infrastructure/db/drizzle/schema.ts",
  out: "./src/infrastructure/db/drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    connectionString: process.env.DATABASE_URL as string,
  },
  verbose: true,
} satisfies Config;

