import { z } from "zod";
import { parseEnvOrExit } from "@trading/shared/env";
import { baseServiceEnvSchema } from "@trading/shared/env/service";

const envSchema = baseServiceEnvSchema.extend({
  MARKET_PROVIDER: z.enum(["binance", "stub"]).default("stub"),
  MARKET_API_KEY: z.string().optional(),
  MARKET_API_SECRET: z.string().optional(),
  SYMBOLS: z.string().min(1).default("BTCUSDT"),
  CANDLE_LIMIT: z.coerce.number().int().positive().default(100),
  LOOKBACK_DAYS: z.coerce.number().int().positive().default(7)
});

export const env = parseEnvOrExit(envSchema, process.env, "market");
export type Env = typeof env;
