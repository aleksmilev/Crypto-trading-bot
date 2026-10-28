import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { z } from "zod";
import { parseEnvOrExit } from "@trading/shared/env";

const { Pool } = pg;

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DB_PASSWORD_MARKET: z.string().min(1),
  DB_PASSWORD_FEATURES: z.string().min(1),
  DB_PASSWORD_AI: z.string().min(1),
  DB_PASSWORD_RISK: z.string().min(1),
  DB_PASSWORD_EXECUTION: z.string().min(1),
  DB_PASSWORD_MANAGER: z.string().min(1)
});

const env = parseEnvOrExit(envSchema, process.env, "migrate");

async function runMigrationFile(client: pg.PoolClient, filePath: string): Promise<void> {
  const sql = await readFile(filePath, "utf-8");
  await client.query(sql);
}

async function applyMigrations(pool: pg.Pool, migrationsDir: string): Promise<void> {
  const files = (await readdir(migrationsDir))
    .filter(f => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    console.log(`Applying migration ${file}...`);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await runMigrationFile(client, filePath);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
}

async function applyGrants(pool: pg.Pool): Promise<void> {
  const roles: Record<string, string> = {
    trading_market: env.DB_PASSWORD_MARKET,
    trading_features: env.DB_PASSWORD_FEATURES,
    trading_ai: env.DB_PASSWORD_AI,
    trading_risk: env.DB_PASSWORD_RISK,
    trading_execution: env.DB_PASSWORD_EXECUTION,
    trading_manager: env.DB_PASSWORD_MANAGER
  };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const [role, password] of Object.entries(roles)) {
      await client.query(`
        DO $$
        BEGIN
          CREATE ROLE ${role} WITH LOGIN PASSWORD '${password}';
        EXCEPTION WHEN duplicate_object THEN
          RAISE NOTICE 'Role ${role} already exists';
        END
        $$
      `);
    }

    // Schema usage and ownership
    await client.query(`
      GRANT USAGE ON SCHEMA config, market, features, ai, risk, execution, manager TO trading_manager;
      GRANT USAGE ON SCHEMA market TO trading_market, trading_features;
      GRANT USAGE ON SCHEMA features TO trading_features, trading_ai, trading_execution;
      GRANT USAGE ON SCHEMA ai TO trading_ai, trading_risk;
      GRANT USAGE ON SCHEMA risk TO trading_risk, trading_execution;
      GRANT USAGE ON SCHEMA execution TO trading_execution;
      GRANT USAGE ON SCHEMA manager TO trading_manager;

      GRANT SELECT ON config.settings TO trading_risk, trading_execution, trading_manager;

      ALTER DEFAULT PRIVILEGES IN SCHEMA market GRANT ALL ON TABLES TO trading_market;
      ALTER DEFAULT PRIVILEGES IN SCHEMA features GRANT ALL ON TABLES TO trading_features;
      ALTER DEFAULT PRIVILEGES IN SCHEMA ai GRANT ALL ON TABLES TO trading_ai;
      ALTER DEFAULT PRIVILEGES IN SCHEMA risk GRANT ALL ON TABLES TO trading_risk;
      ALTER DEFAULT PRIVILEGES IN SCHEMA execution GRANT ALL ON TABLES TO trading_execution;
      ALTER DEFAULT PRIVILEGES IN SCHEMA manager GRANT ALL ON TABLES TO trading_manager;

      GRANT SELECT ON ALL TABLES IN SCHEMA market TO trading_features, trading_ai;
      GRANT SELECT ON ALL TABLES IN SCHEMA features TO trading_ai, trading_risk, trading_execution;
      GRANT SELECT ON ALL TABLES IN SCHEMA ai TO trading_risk;
      GRANT SELECT ON ALL TABLES IN SCHEMA risk TO trading_execution;

      GRANT SELECT ON ALL TABLES IN SCHEMA config TO trading_risk, trading_execution, trading_manager;
      GRANT SELECT ON ALL TABLES IN SCHEMA manager TO trading_manager;
    `);

    // Cross-service reads: features -> market; ai -> features; risk -> ai + execution positions; execution -> risk + features.
    await client.query("COMMIT");
    console.log("Grants applied");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  // In the built image migrations live next to the compiled JS in dist/migrations.
  const migrationsDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "migrations");
  const pool = new Pool({ connectionString: env.DATABASE_URL, max: 2 });

  try {
    await applyMigrations(pool, migrationsDir);
    await applyGrants(pool);
    console.log("Migrations complete");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

void main();
