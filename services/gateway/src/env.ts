import { z } from "zod";
import { parseEnvOrExit } from "@trading/shared/env";

const envSchema = z.object({
  APP_NAME: z.string().default("AI Trading Bot"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  API_PORT: z.coerce.number().int().positive().default(3000),
  ALLOWED_CALLER_CIDRS: z.string().min(1),
  MANAGER_URL: z.string().url().default("http://manager:3000"),
  MARKET_URL: z.string().url().default("http://market:3000"),
  FEATURES_URL: z.string().url().default("http://features:3000"),
  AI_URL: z.string().url().default("http://ai:3000"),
  RISK_URL: z.string().url().default("http://risk:3000"),
  EXECUTION_URL: z.string().url().default("http://execution:3000")
});

export const env = parseEnvOrExit(envSchema, process.env, "gateway");
export type Env = typeof env;

export const serviceUrls: Record<string, string> = {
  market: env.MARKET_URL,
  features: env.FEATURES_URL,
  ai: env.AI_URL,
  risk: env.RISK_URL,
  execution: env.EXECUTION_URL,
  manager: env.MANAGER_URL
};
