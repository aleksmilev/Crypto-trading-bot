import { env } from "../config/env.js";
import { recordJobEvent } from "../db/job-events.js";
import { aiAnalysisJobSchema } from "../queues/jobs.js";
import { QUEUE_NAMES } from "../queues/queues.js";
import { startWorker } from "./start-worker.js";

const SERVICE = "ai-worker";

startWorker({
  service: SERVICE,
  queue: QUEUE_NAMES.aiAnalysis,
  schema: aiAnalysisJobSchema,

  async process({ job, data, log }) {
    log.info(
      { source: data.source, provider: env.AI_PROVIDER, model: env.AI_MODEL },
      "AI analysis job received"
    );

    // TODO(phase 5): build the structured AI request and validate the decision with Zod.

    await recordJobEvent({
      service: SERVICE,
      queue: QUEUE_NAMES.aiAnalysis,
      jobName: job.name,
      jobId: job.id,
      status: "processed",
      payload: data
    });
  }
});
