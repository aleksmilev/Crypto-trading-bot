import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import { createLogger, type Logger } from "./logger.js";
import { createMetrics } from "./metrics.js";
import { registerShutdown } from "./shutdown.js";
import { getClientIp, registerAllowlist } from "./allowlist.js";
import type { Registry } from "prom-client";

export interface ServiceEnv {
  APP_NAME: string;
  NODE_ENV: "development" | "test" | "production";
  LOG_LEVEL: string;
  API_PORT: number;
  ALLOWED_CALLER_CIDRS: string;
}

export interface ServiceOptions {
  name: string;
  env: ServiceEnv;
  routes: (app: FastifyInstance, log: Logger) => Promise<void>;
  ready: () => Promise<{ ok: boolean; details?: Record<string, string> }>;
  metrics?: Registry;
  closers?: Array<() => Promise<unknown>>;
}

export function getInstanceId(service: string): string {
  return `${service}-${process.env.HOSTNAME ?? String(process.pid)}`;
}

export async function createService(options: ServiceOptions): Promise<FastifyInstance> {
  const instance = getInstanceId(options.name);
  const log = createLogger({
    service: options.name,
    appName: options.env.APP_NAME,
    env: options.env.NODE_ENV,
    level: options.env.LOG_LEVEL,
    instance
  });

  const metrics = options.metrics ?? createMetrics(options.name);

  const app = Fastify({
    loggerInstance: log as unknown as FastifyBaseLogger,
    trustProxy: true
  });

  const allowedCidrs = options.env.ALLOWED_CALLER_CIDRS.split(",").map(s => s.trim()).filter(Boolean);
  // Healthchecks and local probes always allowed.
  if (!allowedCidrs.includes("127.0.0.1")) {
    allowedCidrs.push("127.0.0.1");
  }
  registerAllowlist(app, { allowedCidrs, forbiddenMessage: "Forbidden" });

  app.addHook("onRequest", async request => {
    request.log.debug({ ip: getClientIp(request) }, "Incoming request");
  });

  app.get("/health", async () => ({
    status: "ok",
    service: options.name,
    instance
  }));

  app.get("/ready", async (_request, reply) => {
    const check = await options.ready();
    return reply.code(check.ok ? 200 : 503).send({
      service: options.name,
      instance,
      ready: check.ok,
      details: check.details ?? {}
    });
  });

  app.get("/metrics", async (_request, reply) => {
    return reply.header("Content-Type", metrics.contentType).send(await metrics.metrics());
  });

  await options.routes(app, log);

  registerShutdown(log, [
    () => app.close(),
    ...(options.closers ?? []).map(closer => closer)
  ]);

  await app.listen({ host: "0.0.0.0", port: options.env.API_PORT });
  log.info({ port: options.env.API_PORT, instance }, "Service started");

  return app;
}

export function isManagerRequest(request: { ip: string | undefined }, managerIp: string): boolean {
  return request.ip === managerIp || request.ip === "127.0.0.1";
}
