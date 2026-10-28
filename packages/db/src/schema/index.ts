import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core";

export const configSchema = pgSchema("config");
export const marketSchema = pgSchema("market");
export const featuresSchema = pgSchema("features");
export const aiSchema = pgSchema("ai");
export const riskSchema = pgSchema("risk");
export const executionSchema = pgSchema("execution");
export const managerSchema = pgSchema("manager");

export const settings = configSchema.table("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const candles = marketSchema.table(
  "candles",
  {
    symbol: text("symbol").notNull(),
    time: timestamp("time", { withTimezone: true }).notNull(),
    open: numeric("open").notNull(),
    high: numeric("high").notNull(),
    low: numeric("low").notNull(),
    close: numeric("close").notNull(),
    volume: numeric("volume").notNull()
  },
  table => [
    primaryKey({
      name: "candles_symbol_time_pk",
      columns: [table.symbol, table.time]
    })
  ]
);

export const collections = marketSchema.table("collections", {
  runId: uuid("run_id").primaryKey(),
  symbol: text("symbol").notNull(),
  candleCount: integer("candle_count").notNull().default(0),
  earliestAt: timestamp("earliest_at", { withTimezone: true }),
  latestAt: timestamp("latest_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const snapshots = featuresSchema.table("snapshots", {
  runId: uuid("run_id").primaryKey(),
  symbol: text("symbol").notNull(),
  features: jsonb("features").notNull().default({}),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const decisions = aiSchema.table("decisions", {
  runId: uuid("run_id").primaryKey(),
  action: text("action").notNull(),
  symbol: text("symbol").notNull(),
  size: numeric("size"),
  reasoning: text("reasoning").notNull(),
  provider: text("provider").notNull(),
  model: text("model"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const validations = riskSchema.table("validations", {
  runId: uuid("run_id").primaryKey(),
  approved: boolean("approved").notNull(),
  action: text("action").notNull(),
  symbol: text("symbol").notNull(),
  size: numeric("size"),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const orders = executionSchema.table("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").notNull().unique(),
  action: text("action").notNull(),
  symbol: text("symbol").notNull(),
  size: numeric("size").notNull(),
  status: text("status").notNull(),
  reason: text("reason").notNull(),
  fillPrice: numeric("fill_price"),
  fillSize: numeric("fill_size"),
  executedAt: timestamp("executed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const balances = executionSchema.table("balances", {
  symbol: text("symbol").primaryKey(),
  amount: numeric("amount").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const positions = executionSchema.table("positions", {
  symbol: text("symbol").primaryKey(),
  amount: numeric("amount").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const runs = managerSchema.table("runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobType: text("job_type").notNull(),
  trigger: text("trigger").notNull(),
  status: text("status").notNull(),
  error: text("error"),
  summary: jsonb("summary").notNull().default({}),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true })
});

export const runSteps = managerSchema.table("run_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").notNull(),
  step: text("step").notNull(),
  service: text("service").notNull(),
  instance: text("instance").notNull(),
  status: text("status").notNull(),
  request: jsonb("request").notNull().default({}),
  response: jsonb("response").notNull().default({}),
  durationMs: integer("duration_ms").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export type Run = typeof runs.$inferSelect;
export type RunStep = typeof runSteps.$inferSelect;
