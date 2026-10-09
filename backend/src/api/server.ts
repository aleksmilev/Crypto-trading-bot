import Fastify from "fastify";
import { env } from "../config/env.js";
import { closeDatabase } from "../db/connection.js";
import { registerShutdown } from "../lifecycle/shutdown.js";
import { createLogger } from "../logging/logger.js";
import { closeQueues } from "../queues/queues.js";
import { redis } from "../queues/redis.js";
import { registerBullBoard } from "./admin/bull-board.js";
import { healthRoutes } from "./routes/health.js";
import { metricsRoutes } from "./routes/metrics.js";
import { systemRoutes } from "./routes/system.js";
import { testRoutes } from "./routes/test.js";

const log = createLogger("api");

const app = Fastify({ loggerInstance: log });

// Unprefixed routes are for container healthchecks and Prometheus; Caddy only forwards /api/*.
await app.register(healthRoutes);
await app.register(metricsRoutes);

if (env.ENABLE_ADMIN_UI) {
  // Cast: Bull Board's Fastify plugin types conflict with pino's logger generics.
  await registerBullBoard(app as never);
  log.info("Bull Board enabled at /admin/queues");
}

await app.register(
  async api => {
    await api.register(healthRoutes);
    await api.register(systemRoutes);

    if (env.ENABLE_TEST_ROUTES) {
      await api.register(testRoutes);
    }
  },
  { prefix: "/api" }
);

registerShutdown(log, [
  () => app.close(),
  () => closeQueues(),
  () => redis.quit(),
  () => closeDatabase()
]);

// 0.0.0.0 so other containers can reach the API.
await app.listen({ host: "0.0.0.0", port: env.API_PORT });
