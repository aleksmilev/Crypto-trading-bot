import { jsonb, pgSchema, text, timestamp } from "drizzle-orm/pg-core";

export const configSchema = pgSchema("config");

export const settings = configSchema.table("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
});
