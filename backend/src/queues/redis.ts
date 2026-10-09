import { Redis } from "ioredis";
import { env } from "../config/env.js";
import { logger } from "../logging/logger.js";

export function createRedisConnection(connectionName: string): Redis {
  const connection = new Redis(env.REDIS_URL, {
    // Required by BullMQ for blocking connections.
    maxRetriesPerRequest: null,
    connectionName
  });

  connection.on("error", error => {
    logger.error({ err: error, connectionName }, "Redis connection error");
  });

  return connection;
}

export const redis = createRedisConnection("shared");

export async function checkRedis(): Promise<void> {
  await redis.ping();
}
