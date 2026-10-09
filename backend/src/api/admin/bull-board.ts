import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { FastifyAdapter } from "@bull-board/fastify";
import type { FastifyInstance } from "fastify";
import { getQueue, QUEUE_NAMES } from "../../queues/queues.js";

const BASE_PATH = "/admin/queues";

export async function registerBullBoard(app: FastifyInstance): Promise<void> {
  const serverAdapter = new FastifyAdapter();
  serverAdapter.setBasePath(BASE_PATH);

  createBullBoard({
    queues: Object.values(QUEUE_NAMES).map(name => new BullMQAdapter(getQueue(name))),
    serverAdapter
  });

  await app.register(serverAdapter.registerPlugin(), { prefix: BASE_PATH });
}
