import type { FastifyInstance } from "fastify";
import { listRecentJobEvents, recordJobEvent } from "../../db/job-events.js";
import {
  JOB_NAMES,
  type AiAnalysisJob,
  type MarketDataJob,
  type TradeExecutionJob
} from "../../queues/jobs.js";
import { getQueue, QUEUE_NAMES, type QueueName } from "../../queues/queues.js";

// Infrastructure smoke-test endpoints. Registered only when ENABLE_TEST_ROUTES=true.
export async function testRoutes(app: FastifyInstance): Promise<void> {
  const enqueue = async (queue: QueueName, jobName: string, data: object) => {
    const job = await getQueue(queue).add(jobName, data);

    await recordJobEvent({
      service: "api",
      queue,
      jobName,
      jobId: job.id,
      status: "enqueued",
      payload: data
    });

    return { queued: true, queue, jobId: job.id };
  };

  app.post("/test/market-job", async () => {
    const data: MarketDataJob = { source: "api", symbols: ["BTC/USD"] };
    return enqueue(QUEUE_NAMES.marketData, JOB_NAMES.collectMarketData, data);
  });

  app.post("/test/ai-job", async () => {
    const data: AiAnalysisJob = { source: "api" };
    return enqueue(QUEUE_NAMES.aiAnalysis, JOB_NAMES.runAiAnalysis, data);
  });

  app.post("/test/execution-job", async () => {
    const data: TradeExecutionJob = { source: "api" };
    return enqueue(QUEUE_NAMES.tradeExecution, JOB_NAMES.executeOrder, data);
  });

  app.get("/test/job-events", async () => {
    return { events: await listRecentJobEvents(25) };
  });
}
