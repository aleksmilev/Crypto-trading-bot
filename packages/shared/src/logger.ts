import pino from "pino";

export type Logger = pino.Logger;

export interface LoggerOptions {
  service: string;
  appName: string;
  env: string;
  level: string;
  instance?: string;
}

export function createLogger(options: LoggerOptions): Logger {
  return pino({
    level: options.level,
    base: {
      app: options.appName,
      env: options.env,
      instance: options.instance ?? `${options.service}-${process.pid}`
    },
    redact: {
      paths: [
        "*.apiKey",
        "*.apiSecret",
        "*.password",
        "*.token",
        "req.headers.authorization",
        "req.headers.cookie",
        'req.headers["x-api-key"]'
      ],
      censor: "[REDACTED]"
    }
  }).child({ service: options.service });
}
