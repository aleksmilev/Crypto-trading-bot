import { recordJobEvent } from "../db/job-events.js";
import { JOB_NAMES, marketDataJobSchema, type FeaturesJob } from "../queues/jobs.js";
import { getQueue, QUEUE_NAMES } from "../queues/queues.js";
import { startWorker } from "./start-worker.js";

const SERVICE = "market-worker";

startWorker({
  service: SERVICE,
  queue: QUEUE_NAMES.marketData,
  schema: marketDataJobSchema,

  async process({ job, data, log }) {
    log.info({ source: data.source, symbols: data.symbols }, "Market data job received");

    // TODO(phase 2): fetch and store OHLCV candles from the market provider.

    await recordJobEvent({
      service: SERVICE,
      queue: QUEUE_NAMES.marketData,
      jobName: job.name,
      jobId: job.id,
      status: "processed",
      payload: data
    });

    const featuresJob: FeaturesJob = { source: "worker", marketJobId: job.id };

    await getQueue(QUEUE_NAMES.features).add(JOB_NAMES.calculateFeatures, featuresJob, {
      jobId: `features-${job.id}`
    });

    log.info("Queued feature calculation");
  }
});
