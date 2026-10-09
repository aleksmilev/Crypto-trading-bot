import {
  bigserial,
  index,
  jsonb,
  pgSchema,
  text,
  timestamp
} from "drizzle-orm/pg-core";

export const tradingSchema = pgSchema("trading");

export const jobEvents = tradingSchema.table(
  "job_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    service: text("service").notNull(),
    queue: text("queue").notNull(),
    jobName: text("job_name").notNull(),
    jobId: text("job_id"),
    status: text("status").notNull(),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  table => [index("job_events_created_at_idx").on(table.createdAt)]
);
