import { desc } from "drizzle-orm";
import { db } from "./connection.js";
import { jobEvents } from "./schema/index.js";

export interface JobEventInput {
  service: string;
  queue: string;
  jobName: string;
  jobId?: string | undefined;
  status: string;
  payload?: unknown;
}

export async function recordJobEvent(event: JobEventInput): Promise<void> {
  await db.insert(jobEvents).values({
    service: event.service,
    queue: event.queue,
    jobName: event.jobName,
    jobId: event.jobId ?? null,
    status: event.status,
    payload: event.payload ?? null
  });
}

export async function listRecentJobEvents(limit = 20) {
  return db
    .select()
    .from(jobEvents)
    .orderBy(desc(jobEvents.createdAt), desc(jobEvents.id))
    .limit(limit);
}
