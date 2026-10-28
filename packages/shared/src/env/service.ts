import { z } from "zod";

export const baseServiceEnvSchema = z.object({
  APP_NAME: z.string().default("AI Trading Bot"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  API_PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  ALLOWED_CALLER_CIDRS: z.string().min(1),
  MANAGER_IP: z.string().default("127.0.0.1")
});

export type BaseServiceEnv = z.infer<typeof baseServiceEnvSchema>;
