import { z } from "zod";
import { baseServiceEnvSchema } from "@trading/shared/env/service";
import { parseEnvOrExit } from "@trading/shared/env";

const envSchema = baseServiceEnvSchema.extend({
  DEFAULT_SYMBOL: z.string().min(1).default("BTCUSDT")
});

export const env = parseEnvOrExit(envSchema, process.env, "risk");
export type Env = typeof env;
