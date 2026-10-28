import { Cron } from "croner";
import { eq, desc, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import * as schema from "@trading/db/schema";
import { createDatabase } from "@trading/shared/db";
import { createLogger } from "@trading/shared/logger";
import { createService, getInstanceId } from "@trading/shared/service";
import {
  managerStartCycleCommandSchema,
  managerStartCycleResponseSchema,
  managerRunsQuerySchema,
  runStatusSchema
} from "@trading/shared/contracts";
import { env } from "./env.js";
import { Engine } from "./engine.js";

const instance = getInstanceId("manager");
const logger = createLogger({
  service: "manager",
  appName: env.APP_NAME,
  env: env.NODE_ENV,
  level: env.LOG_LEVEL,
  instance
});

const { db, close } = createDatabase(env.DATABASE_URL, schema, logger);
const engine = new Engine(env, db, logger);

function isGatewayOrLocal(request: { ip: string | undefined }): boolean {
  return request.ip === env.GATEWAY_IP || request.ip === "127.0.0.1";
}

async function routes(app: FastifyInstance): Promise<void> {
  app.post("/commands/cycles", async (request, reply) => {
    if (!isGatewayOrLocal(request)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const parsed = managerStartCycleCommandSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.message });
    }

    const { trigger, symbols } = parsed.data;
    const result = await engine.startCycle(trigger, symbols);
    return managerStartCycleResponseSchema.parse(result);
  });

  app.get("/queries/runs", async (request, reply) => {
    const parsed = managerRunsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.message });
    }

    const { limit, offset, status } = parsed.data;
    const runs = await engine.getRuns({ limit, offset, status });
    return { runs };
  });

  app.get("/queries/runs/:id", async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: params.error.message });
    }

    const { run, steps } = await engine.getRun(params.data.id);
    return { run, steps };
  });

  app.get("/queries/summary", async () => {
    return engine.getSummary();
  });
}

async function main(): Promise<void> {
  await engine.onStartup();

  const job = new Cron(env.CYCLE_CRON, { timezone: "UTC" }, () => {
    logger.info("Scheduled cycle tick");
    void engine.startCycle("schedule");
  });

  await createService({
    name: "manager",
    env,
    routes,
    ready: async () => {
      try {
        await db.query.runs.findFirst();
        return { ok: true };
      } catch (error) {
        return { ok: false, details: { database: String(error) } };
      }
    },
    closers: [
      close,
      async () => {
        job.stop();
      }
    ]
  });
}

void main();
