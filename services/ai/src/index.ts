import { eq, desc } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import * as schema from "@trading/db/schema";
import { createDatabase } from "@trading/shared/db";
import { createLogger } from "@trading/shared/logger";
import { createService, getInstanceId, isManagerRequest } from "@trading/shared/service";
import {
  aiDecideCommandSchema,
  aiDecideResponseSchema
} from "@trading/shared/contracts";
import { env } from "./env.js";
import { createProvider } from "./providers/index.js";

const provider = createProvider();
const instance = getInstanceId("ai");
const logger = createLogger({
  service: "ai",
  appName: env.APP_NAME,
  env: env.NODE_ENV,
  level: env.LOG_LEVEL,
  instance
});

const { db, close } = createDatabase(env.DATABASE_URL, schema, logger);

async function routes(app: FastifyInstance): Promise<void> {
  app.post("/commands/decide", async (request, reply) => {
    if (!isManagerRequest(request, env.MANAGER_IP)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const parsed = aiDecideCommandSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.message });
    }

    const { runId } = parsed.data;

    const existing = await db
      .select()
      .from(schema.decisions)
      .where(eq(schema.decisions.runId, runId))
      .limit(1);

    if (existing.length > 0) {
      return aiDecideResponseSchema.parse({
        runId,
        status: "decided",
        decision: {
          action: existing[0].action as "none" | "buy" | "sell",
          symbol: existing[0].symbol,
          size: existing[0].size ? Number(existing[0].size) : undefined,
          reasoning: existing[0].reasoning
        },
        provider: existing[0].provider,
        model: existing[0].model ?? undefined
      });
    }

    const snapshot = await db
      .select()
      .from(schema.snapshots)
      .where(eq(schema.snapshots.runId, runId))
      .limit(1);

    if (snapshot.length === 0) {
      return reply.code(400).send({ error: `No feature snapshot for run ${runId}` });
    }

    const decision = await provider.decide({
      runId,
      symbol: snapshot[0].symbol,
      features: snapshot[0].features as Record<string, number>
    });

    await db.insert(schema.decisions).values({
      runId,
      action: decision.action,
      symbol: decision.symbol,
      size: decision.size ? String(decision.size) : null,
      reasoning: decision.reasoning,
      provider: provider.name,
      model: provider.model
    });

    return aiDecideResponseSchema.parse({
      runId,
      status: "decided",
      decision,
      provider: provider.name,
      model: provider.model
    });
  });

  app.get("/queries/latest", async () => {
    const latest = await db
      .select()
      .from(schema.decisions)
      .orderBy(desc(schema.decisions.createdAt))
      .limit(1);

    return {
      latest: latest[0] ?? null
    };
  });

  app.get("/queries/decisions", async () => {
    const rows = await db
      .select()
      .from(schema.decisions)
      .orderBy(desc(schema.decisions.createdAt))
      .limit(50);

    return {
      decisions: rows.map(r => ({
        runId: r.runId,
        action: r.action,
        symbol: r.symbol,
        size: r.size ? Number(r.size) : null,
        reasoning: r.reasoning,
        provider: r.provider,
        model: r.model,
        createdAt: r.createdAt.toISOString()
      }))
    };
  });
}

async function main(): Promise<void> {
  await createService({
    name: "ai",
    env,
    routes,
    ready: async () => {
      try {
        await db.query.decisions.findFirst();
        return { ok: true };
      } catch (error) {
        return { ok: false, details: { database: String(error) } };
      }
    },
    closers: [close]
  });
}

void main();
