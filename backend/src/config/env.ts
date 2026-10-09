import { z } from "zod";
import {
  DEFAULT_AI_DECISION_CRON,
  DEFAULT_API_PORT,
  DEFAULT_MARKET_INTERVAL_MINUTES,
  DEFAULT_SCHEDULER_TIMEZONE
} from "./defaults.js";
import { parseEnvOrExit } from "./parse.js";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  APP_NAME: z.string().default("AI Trading Bot"),

  API_PORT: z.coerce.number().int().positive().default(DEFAULT_API_PORT),

  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),

  DATABASE_URL: z.string().min(1),

  REDIS_URL: z.string().min(1),

  AI_PROVIDER: z.string().default("openai"),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),

  MARKET_PROVIDER: z.string().optional(),
  MARKET_API_KEY: z.string().optional(),
  MARKET_API_SECRET: z.string().optional(),

  TRADING_ENABLED: z.stringbool().default(false),

  TRADING_MODE: z.enum(["shadow", "paper", "live"]).default("shadow"),

  MARKET_INTERVAL_MINUTES: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_MARKET_INTERVAL_MINUTES),

  AI_DECISION_CRON: z.string().min(1).default(DEFAULT_AI_DECISION_CRON),

  SCHEDULER_TIMEZONE: z.string().min(1).default(DEFAULT_SCHEDULER_TIMEZONE),

  ENABLE_TEST_ROUTES: z.stringbool().default(false),

  // Adminer / Redis Insight / Bull Board links. Only enable in development.
  ENABLE_ADMIN_UI: z.stringbool().default(false),

  ADMIN_ADMINER_URL: z.string().default("http://localhost:8081"),
  ADMIN_REDIS_INSIGHT_URL: z.string().default("http://localhost:8082"),
  ADMIN_BULL_BOARD_URL: z.string().default("/admin/queues"),
  ADMIN_GRAFANA_URL: z.string().default("http://localhost:3001")
});

export type Env = z.infer<typeof envSchema>;

export type TradingMode = Env["TRADING_MODE"];

export const env: Env = parseEnvOrExit(envSchema, process.env, "environment");
