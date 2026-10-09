import { env } from "../config/env.js";
import { registerShutdown } from "../lifecycle/shutdown.js";
import { createLogger } from "../logging/logger.js";
import { JOB_NAMES, type AiAnalysisJob, type MarketDataJob } from "../queues/jobs.js";
import { closeQueues, getQueue, QUEUE_NAMES } from "../queues/queues.js";
import { redis } from "../queues/redis.js";

const log = createLogger("scheduler");

registerShutdown(log, [
  () => closeQueues(),
  () => redis.quit()
]);

const marketJob: MarketDataJob = { source: "scheduler" };
const aiJob: AiAnalysisJob = { source: "scheduler" };

await getQueue(QUEUE_NAMES.marketData).upsertJobScheduler(
  "market-data-interval",
  { every: env.MARKET_INTERVAL_MINUTES * 60_000 },
  { name: JOB_NAMES.collectMarketData, data: marketJob }
);

await getQueue(QUEUE_NAMES.aiAnalysis).upsertJobScheduler(
  "ai-analysis-cron",
  { pattern: env.AI_DECISION_CRON, tz: env.SCHEDULER_TIMEZONE },
  { name: JOB_NAMES.runAiAnalysis, data: aiJob }
);

log.info(
  {
    marketIntervalMinutes: env.MARKET_INTERVAL_MINUTES,
    aiDecisionCron: env.AI_DECISION_CRON,
    timezone: env.SCHEDULER_TIMEZONE
  },
  "Job schedulers registered"
);
