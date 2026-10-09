import type { FastifyInstance } from "fastify";
import { env } from "../../config/env.js";
import { getQueue, QUEUE_NAMES } from "../../queues/queues.js";

const MONITORED_QUEUES = [
  QUEUE_NAMES.marketData,
  QUEUE_NAMES.features,
  QUEUE_NAMES.aiAnalysis,
  QUEUE_NAMES.tradeExecution
];

interface CredentialField {
  label: string;
  value: string;
}

function parseDatabaseUrl(url: string): {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
} {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || "postgres",
      port: parsed.port || "5432",
      user: decodeURIComponent(parsed.username || "trading"),
      password: decodeURIComponent(parsed.password || ""),
      database: decodeURIComponent(parsed.pathname.replace(/^\//, "") || "trading")
    };
  } catch {
    return {
      host: "postgres",
      port: "5432",
      user: "trading",
      password: "",
      database: "trading"
    };
  }
}

function parseRedisUrl(url: string): { host: string; port: string; password: string } {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || "redis",
      port: parsed.port || "6379",
      password: decodeURIComponent(parsed.password || "")
    };
  } catch {
    return { host: "redis", port: "6379", password: "" };
  }
}

function adminTools() {
  if (!env.ENABLE_ADMIN_UI) {
    return [];
  }

  const db = parseDatabaseUrl(env.DATABASE_URL);
  const redis = parseRedisUrl(env.REDIS_URL);

  return [
    {
      id: "adminer",
      name: "Adminer",
      description: "PostgreSQL / TimescaleDB",
      url: env.ADMIN_ADMINER_URL,
      credentials: [
        { label: "System", value: "PostgreSQL" },
        { label: "Server", value: db.host },
        { label: "Username", value: db.user },
        { label: "Password", value: db.password },
        { label: "Database", value: db.database }
      ] satisfies CredentialField[]
    },
    {
      id: "redis-insight",
      name: "Redis Insight",
      description: "Redis keys and BullMQ data",
      url: env.ADMIN_REDIS_INSIGHT_URL,
      credentials: [
        { label: "Host", value: redis.host },
        { label: "Port", value: redis.port },
        { label: "Password", value: redis.password || "(none)" }
      ] satisfies CredentialField[]
    },
    {
      id: "bull-board",
      name: "Bull Board",
      description: "BullMQ job queues",
      url: env.ADMIN_BULL_BOARD_URL,
      credentials: [{ label: "Auth", value: "(none — open link)" }] satisfies CredentialField[]
    },
    {
      id: "grafana",
      name: "Grafana",
      description: "Metrics dashboards",
      url: env.ADMIN_GRAFANA_URL,
      credentials: [
        { label: "Username", value: env.GRAFANA_USER },
        {
          label: "Password",
          value: env.GRAFANA_PASSWORD ?? "(set GRAFANA_PASSWORD in .env)"
        }
      ] satisfies CredentialField[]
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
