import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createLogger } from "../logging/logger.js";
import { closeDatabase, db } from "./connection.js";

const log = createLogger("migrate");

const migrationsFolder = fileURLToPath(new URL("./migrations", import.meta.url));

try {
  log.info({ migrationsFolder }, "Running database migrations");
  await migrate(db, { migrationsFolder });
  log.info("Database migrations complete");
} catch (error) {
  log.fatal({ err: error }, "Database migration failed");
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
