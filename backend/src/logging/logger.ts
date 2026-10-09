import pino from "pino";
import { env } from "../config/env.js";

export const logger = pino({
  level: env.LOG_LEVEL,
  base: {
    app: env.APP_NAME,
    env: env.NODE_ENV
  },
  redact: {
    paths: [
      "*.apiKey",
      "*.apiSecret",
      "*.password",
      "*.token",
      "req.headers.authorization",
      "req.headers.cookie"
    ],
    censor: "[REDACTED]"
  }
});

export type Logger = pino.Logger;

export function createLogger(service: string): Logger {
  return logger.child({ service });
}
