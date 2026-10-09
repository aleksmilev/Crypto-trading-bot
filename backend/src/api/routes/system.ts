import type { FastifyInstance } from "fastify";
import { env } from "../../config/env.js";
import { getQueue, QUEUE_NAMES } from "../../queues/queues.js";

const MONITORED_QUEUES = [
  QUEUE_NAMES.marketData,
  QUEUE_NAMES.features,
  QUEUE_NAMES.aiAnalysis,
  QUEUE_NAMES.tradeExecution
];

export async function systemRoutes(app: FastifyInstance): Promise<void> {
  app.get("/system/status", async () => {
    const queues = await Promise.all(
      MONITORED_QUEUES.map(async name => ({
        name,
        counts: await getQueue(name).getJobCounts(
          "waiting",
          "active",
          "delayed",
          "completed",
          "failed"
        )
      }))
    );

    return {
      appName: env.APP_NAME,
      nodeEnv: env.NODE_ENV,
      tradingEnabled: env.TRADING_ENABLED,
      tradingMode: env.TRADING_MODE,
      testRoutesEnabled: env.ENABLE_TEST_ROUTES,
      queues
    };
  });
}
