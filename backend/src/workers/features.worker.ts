import { recordJobEvent } from "../db/job-events.js";
import { featuresJobSchema } from "../queues/jobs.js";
import { QUEUE_NAMES } from "../queues/queues.js";
import { startWorker } from "./start-worker.js";

const SERVICE = "feature-worker";

startWorker({
  service: SERVICE,
  queue: QUEUE_NAMES.features,
  schema: featuresJobSchema,

  async process({ job, data, log }) {
    log.info({ marketJobId: data.marketJobId }, "Feature job received");

    // TODO(phase 3): calculate returns, volatility and indicators from stored candles.

    await recordJobEvent({
      service: SERVICE,
      queue: QUEUE_NAMES.features,
      jobName: job.name,
      jobId: job.id,
      status: "processed",
      payload: data
    });
  }
});
