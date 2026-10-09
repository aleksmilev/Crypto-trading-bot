import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "../config/env.js";
import { logger } from "../logging/logger.js";
import * as schema from "./schema/index.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10
});

// Without a listener, an error on an idle client would crash the process.
pool.on("error", error => {
  logger.error({ err: error }, "PostgreSQL pool error");
});

export const db = drizzle({ client: pool, schema });

export async function checkDatabase(): Promise<void> {
  await pool.query("SELECT 1");
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
