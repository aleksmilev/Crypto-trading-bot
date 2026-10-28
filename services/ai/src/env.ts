import { z } from "zod";
import { baseServiceEnvSchema } from "@trading/shared/env/service";
import { parseEnvOrExit } from "@trading/shared/env";

const envSchema = baseServiceEnvSchema.extend({
  AI_PROVIDER: z.enum(["stub", "openai"]).default("stub"),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
  AI_API_URL: z.string().url().default("https://api.openai.com/v1")
});

export const env = parseEnvOrExit(envSchema, process.env, "ai");
export type Env = typeof env;
