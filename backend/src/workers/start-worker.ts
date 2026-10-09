import { Worker, type Job } from "bullmq";
import type { z } from "zod";
import { closeDatabase } from "../db/connection.js";
import { registerShutdown } from "../lifecycle/shutdown.js";
import { createLogger, type Logger } from "../logging/logger.js";
import { closeQueues, type QueueName } from "../queues/queues.js";
import { createRedisConnection, redis } from "../queues/redis.js";

export interface WorkerContext<T> {
  job: Job;
  data: T;
  log: Logger;
}

export interface StartWorkerOptions<S extends z.ZodType> {
  service: string;
  queue: QueueName;
  schema: S;
  concurrency?: number;
  process: (context: WorkerContext<z.infer<S>>) => Promise<unknown>;
}

export function startWorker<S extends z.ZodType>(options: StartWorkerOptions<S>): Worker {
  const log = createLogger(options.service);
  const connection = createRedisConnection(options.service);

  const worker = new Worker(
    options.queue,
    async job => {
      const parsed = options.schema.safeParse(job.data);

      if (!parsed.success) {
        throw new Error(`Invalid ${options.queue} job payload: ${parsed.error.message}`);
      }

      const jobLog = log.child({ jobId: job.id, jobName: job.name });
      return options.process({ job, data: parsed.data, log: jobLog });
    },
    {
      connection,
      concurrency: options.concurrency ?? 1
    }
  );

  worker.on("ready", () => log.info({ queue: options.queue }, "Worker ready"));
  worker.on("completed", job => log.info({ jobId: job.id }, "Job completed"));
  worker.on("failed", (job, error) =>
    log.error({ jobId: job?.id, attemptsMade: job?.attemptsMade, err: error }, "Job failed")
  );
  worker.on("error", error => log.error({ err: error }, "Worker error"));

  registerShutdown(log, [
    () => worker.close(),
    () => closeQueues(),
    () => connection.quit(),
    () => redis.quit(),
    () => closeDatabase()
  ]);

  return worker;
}
