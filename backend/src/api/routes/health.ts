import type { FastifyInstance } from "fastify";
import { env } from "../../config/env.js";
import { checkDatabase } from "../../db/connection.js";
import { checkRedis } from "../../queues/redis.js";

type DependencyStatus = "ok" | "error";

const CHECK_TIMEOUT_MS = 2_000;

async function probe(check: () => Promise<void>): Promise<DependencyStatus> {
  let timer: NodeJS.Timeout | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), CHECK_TIMEOUT_MS);
  });

  try {
    await Promise.race([check(), timeout]);
    return "ok";
  } catch {
    return "error";
  } finally {
    clearTimeout(timer);
  }
}

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async (_request, reply) => {
    const [postgres, redis] = await Promise.all([probe(checkDatabase), probe(checkRedis)]);
    const healthy = postgres === "ok" && redis === "ok";

    return reply.code(healthy ? 200 : 503).send({
      status: healthy ? "ok" : "degraded",
      postgres,
      redis,
      tradingEnabled: env.TRADING_ENABLED,
      tradingMode: env.TRADING_MODE
    });
  });
}
