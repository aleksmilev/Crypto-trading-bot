import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: [
    "./src/db/schema/config.ts",
    "./src/db/schema/trading.ts"
  ],
  out: "./src/db/migrations",
  schemaFilter: ["config", "trading"],
  dbCredentials: {
    url: process.env.DATABASE_URL ?? ""
  }
});
