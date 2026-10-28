import pg from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Logger } from "./logger.js";

const { Pool } = pg;

export interface Database<TSchema extends Record<string, unknown> = Record<string, unknown>> {
  pool: pg.Pool;
  db: NodePgDatabase<TSchema>;
  check: () => Promise<void>;
  close: () => Promise<void>;
}

export function createDatabase<TSchema extends Record<string, unknown>>(
  url: string,
  schema: TSchema,
  logger: Logger
): Database<TSchema> {
  const pool = new Pool({
    connectionString: url,
    max: 10
  });

  pool.on("error", error => {
    logger.error({ err: error }, "PostgreSQL pool error");
  });

  const db = drizzle({ client: pool, schema });

  return {
    pool,
    db,
    check: async () => {
      await pool.query("SELECT 1");
    },
    close: async () => {
      await pool.end();
    }
  };
}
