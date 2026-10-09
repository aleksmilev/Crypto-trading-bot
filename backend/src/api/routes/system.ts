import type { FastifyInstance } from "fastify";
import { env } from "../../config/env.js";
import { getQueue, QUEUE_NAMES } from "../../queues/queues.js";

const MONITORED_QUEUES = [
  QUEUE_NAMES.marketData,
  QUEUE_NAMES.features,
  QUEUE_NAMES.aiAnalysis,
  QUEUE_NAMES.tradeExecution
];

function adminTools() {
  if (!env.ENABLE_ADMIN_UI) {
    return [];
  }

  return [
    {
      id: "adminer",
      name: "Adminer",
      description: "PostgreSQL / TimescaleDB",
      url: env.ADMIN_ADMINER_URL,
      hint: "System: PostgreSQL · Server: postgres · User: trading · DB: trading"
    },
    {
      id: "redis-insight",
      name: "Redis Insight",
      description: "Redis keys and BullMQ data",
      url: env.ADMIN_REDIS_INSIGHT_URL,
      hint: "Add database host redis, port 6379"
    },
    {
      id: "bull-board",
      name: "Bull Board",
      description: "BullMQ job queues",
      url: env.ADMIN_BULL_BOARD_URL
    },
    {
      id: "grafana",
      name: "Grafana",
      description: "Metrics dashboards",
      url: env.ADMIN_GRAFANA_URL,
      hint: "admin / GRAFANA_PASSWORD from .env"
    }
  ];
}

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
      adminUiEnabled: env.ENABLE_ADMIN_UI,
      adminTools: adminTools(),
      queues
    };
  });
}
