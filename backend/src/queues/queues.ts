import { Queue, type DefaultJobOptions } from "bullmq";
import { redis } from "./redis.js";

export const QUEUE_NAMES = {
  marketData: "market-data",
  features: "features",
  aiAnalysis: "ai-analysis",
  positionSizing: "position-sizing",
  riskValidation: "risk-validation",
  tradeExecution: "trade-execution",
  portfolioSync: "portfolio-sync",
  maintenance: "maintenance"
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

const defaultJobOptions: DefaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 5_000 },
  removeOnComplete: { count: 1_000 },
  removeOnFail: { count: 5_000 }
};

// Automatic retries could submit the same order twice; execution retries must be explicit.
const jobOptionsByQueue: Partial<Record<QueueName, DefaultJobOptions>> = {
  [QUEUE_NAMES.tradeExecution]: { ...defaultJobOptions, attempts: 1 }
};

const queues = new Map<QueueName, Queue>();

export function getQueue(name: QueueName): Queue {
  let queue = queues.get(name);

  if (!queue) {
    queue = new Queue(name, {
      connection: redis,
      defaultJobOptions: jobOptionsByQueue[name] ?? defaultJobOptions
    });
    queues.set(name, queue);
  }

  return queue;
}

export async function closeQueues(): Promise<void> {
  await Promise.all([...queues.values()].map(queue => queue.close()));
  queues.clear();
}
