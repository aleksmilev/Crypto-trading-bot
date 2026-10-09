import { env } from "../config/env.js";
import { loadExecutionEnv } from "../config/execution-env.js";
import { recordJobEvent } from "../db/job-events.js";
import { getExecutionPermission } from "../execution/guard.js";
import { tradeExecutionJobSchema } from "../queues/jobs.js";
import { QUEUE_NAMES } from "../queues/queues.js";
import { startWorker } from "./start-worker.js";

const SERVICE = "execution-worker";

const executionEnv = loadExecutionEnv();

startWorker({
  service: SERVICE,
  queue: QUEUE_NAMES.tradeExecution,
  schema: tradeExecutionJobSchema,

  async process({ job, data, log }) {
    const permission = await getExecutionPermission();

    log.info(
      {
        orderRequestId: data.orderRequestId,
        tradingMode: env.TRADING_MODE,
        brokerUrl: executionEnv.BROKER_API_URL,
        permission
      },
      "Execution job received"
    );

    // TODO(phase 8): submit the approved order to the broker with an idempotency key.
    const status = permission.allowed ? "not-implemented" : "blocked";

    await recordJobEvent({
      service: SERVICE,
      queue: QUEUE_NAMES.tradeExecution,
      jobName: job.name,
      jobId: job.id,
      status,
      payload: { ...data, reason: permission.reason }
    });
  }
});
