import { z } from "zod";
import { baseServiceEnvSchema } from "@trading/shared/env/service";
import { parseEnvOrExit } from "@trading/shared/env";

const envSchema = baseServiceEnvSchema.extend({
  CYCLE_CRON: z.string().min(1).default("*/5 * * * *"),
  MANAGER_IP: z.string().default("127.0.0.1"),
  STEP_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  MARKET_URL: z.string().url().default("http://market:3000"),
  FEATURES_URL: z.string().url().default("http://features:3000"),
  AI_URL: z.string().url().default("http://ai:3000"),
  RISK_URL: z.string().url().default("http://risk:3000"),
  EXECUTION_URL: z.string().url().default("http://execution:3000"),
  SYMBOLS: z.string().min(1).default("BTCUSDT"),
  GATEWAY_IP: z.string().default("127.0.0.1")
});

export const env = parseEnvOrExit(envSchema, process.env, "manager");
export type Env = typeof env;
