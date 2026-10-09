import type { FastifyInstance } from "fastify";
import { collectDefaultMetrics, Registry } from "prom-client";

const registry = new Registry();

collectDefaultMetrics({ register: registry, prefix: "trading_api_" });

export async function metricsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/metrics", async (_request, reply) => {
    return reply.header("Content-Type", registry.contentType).send(await registry.metrics());
  });
}
