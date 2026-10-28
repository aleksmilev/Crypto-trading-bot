import { z } from "zod";
import { baseServiceEnvSchema } from "@trading/shared/env/service";
import { booleanFromEnv, parseEnvOrExit } from "@trading/shared/env";

const envSchema = baseServiceEnvSchema.extend({
  TRADING_ENABLED: booleanFromEnv(false),
  TRADING_MODE: z.enum(["shadow", "paper", "live"]).default("shadow"),
  BROKER_API_URL: z.string().url().optional(),
  BROKER_API_KEY: z.string().optional(),
  BROKER_API_SECRET: z.string().optional(),
  DEFAULT_SYMBOL: z.string().min(1).default("BTCUSDT")
});

export const env = parseEnvOrExit(envSchema, process.env, "execution");
export type Env = typeof env;
