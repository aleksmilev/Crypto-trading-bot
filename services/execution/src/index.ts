import { eq, desc } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import * as schema from "@trading/db/schema";
import { createDatabase } from "@trading/shared/db";
import { createLogger } from "@trading/shared/logger";
import { createService, getInstanceId, isManagerRequest } from "@trading/shared/service";
import {
  executionExecuteCommandSchema,
  executionExecuteResponseSchema,
  executionSyncPortfolioCommandSchema,
  executionSyncPortfolioResponseSchema,
  type Action
} from "@trading/shared/contracts";
import { env } from "./env.js";
import { getExecutionPermission } from "./guard.js";
import { createProvider } from "./providers/index.js";

const provider = createProvider();
const instance = getInstanceId("execution");
const logger = createLogger({
  service: "execution",
  appName: env.APP_NAME,
  env: env.NODE_ENV,
  level: env.LOG_LEVEL,
  instance
});

const { db, close } = createDatabase(env.DATABASE_URL, schema, logger);

async function routes(app: FastifyInstance): Promise<void> {
  app.post("/commands/execute", async (request, reply) => {
    if (!isManagerRequest(request, env.MANAGER_IP)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const parsed = executionExecuteCommandSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.message });
    }

    const { runId, order } = parsed.data;

    const existing = await db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.runId, runId))
      .limit(1);

    if (existing.length > 0) {
      return executionExecuteResponseSchema.parse({
        runId,
        status: "already_done",
        order: {
          action: existing[0].action as Action,
          symbol: existing[0].symbol,
          size: Number(existing[0].size),
          runId
        },
        reason: "Order already recorded for this run",
        fillPrice: existing[0].fillPrice ? Number(existing[0].fillPrice) : undefined,
        fillSize: existing[0].fillSize ? Number(existing[0].fillSize) : undefined,
        executedAt: existing[0].executedAt?.toISOString()
      });
    }

    const validation = await db
      .select()
      .from(schema.validations)
      .where(eq(schema.validations.runId, runId))
      .limit(1);

    if (validation.length === 0 || !validation[0].approved) {
      return reply.code(400).send({ error: "No approved risk validation for this run" });
    }

    const permission = await getExecutionPermission(db);

    const action = validation[0].action as Action;
    const symbol = validation[0].symbol;
    const size = validation[0].size ? Number(validation[0].size) : order?.size;

    if (!size || size <= 0 || action === "none") {
      return reply.code(400).send({ error: "No executable order" });
    }

    if (!permission.allowed) {
      await db.insert(schema.orders).values({
        runId,
        action,
        symbol,
        size: String(size),
        status: "blocked",
        reason: permission.reason
      });

      return executionExecuteResponseSchema.parse({
        runId,
        status: "blocked",
        order: { action, symbol, size, runId },
        reason: permission.reason
      });
    }

    if (env.TRADING_MODE === "paper" || env.TRADING_MODE === "live") {
      try {
        const { fillPrice, fillSize } = await provider.submitOrder({
          action: action as "buy" | "sell",
          symbol,
          size,
          runId
        });
        const executedAt = new Date();

        await db.insert(schema.orders).values({
          runId,
          action,
          symbol,
          size: String(size),
          status: env.TRADING_MODE === "live" ? "executed" : "paper_filled",
          reason: permission.reason,
          fillPrice: String(fillPrice),
          fillSize: String(fillSize),
          executedAt
        });

        return executionExecuteResponseSchema.parse({
          runId,
          status: env.TRADING_MODE === "live" ? "executed" : "executed",
          order: { action, symbol, size, runId },
          reason: permission.reason,
          fillPrice,
          fillSize,
          executedAt: executedAt.toISOString()
        });
      } catch (error) {
        await db.insert(schema.orders).values({
          runId,
          action,
          symbol,
          size: String(size),
          status: "failed",
          reason: String(error)
        });
        throw error;
      }
    }

    return executionExecuteResponseSchema.parse({
      runId,
      status: "not_implemented",
      order: { action, symbol, size, runId },
      reason: permission.reason
    });
  });

  app.post("/commands/sync-portfolio", async (request, reply) => {
    if (!isManagerRequest(request, env.MANAGER_IP)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const parsed = executionSyncPortfolioCommandSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.message });
    }

    const { runId } = parsed.data;
    const { balances, positions } = await provider.syncPortfolio();
    const syncedAt = new Date();

    for (const [symbol, amount] of Object.entries(balances)) {
      await db
        .insert(schema.balances)
        .values({ symbol, amount: String(amount), updatedAt: syncedAt })
        .onConflictDoUpdate({
          target: schema.balances.symbol,
          set: { amount: String(amount), updatedAt: syncedAt }
        });
    }

    for (const [symbol, amount] of Object.entries(positions)) {
      await db
        .insert(schema.positions)
        .values({ symbol, amount: String(amount), updatedAt: syncedAt })
        .onConflictDoUpdate({
          target: schema.positions.symbol,
          set: { amount: String(amount), updatedAt: syncedAt }
        });
    }

    return executionSyncPortfolioResponseSchema.parse({
      runId,
      status: "synced",
      balances,
      positions,
      syncedAt: syncedAt.toISOString()
    });
  });

  app.get("/queries/wallet", async () => {
    const rows = await db.select().from(schema.balances);
    return {
      balances: rows.map(r => ({ symbol: r.symbol, amount: Number(r.amount) }))
    };
  });

  app.get("/queries/positions", async () => {
    const rows = await db.select().from(schema.positions);
    return {
      positions: rows.map(r => ({ symbol: r.symbol, amount: Number(r.amount) }))
    };
  });

  app.get("/queries/orders", async () => {
    const rows = await db
      .select()
      .from(schema.orders)
      .orderBy(desc(schema.orders.createdAt))
      .limit(50);

    return {
      orders: rows.map(r => ({
        runId: r.runId,
        action: r.action,
        symbol: r.symbol,
        size: Number(r.size),
        status: r.status,
        reason: r.reason,
        fillPrice: r.fillPrice ? Number(r.fillPrice) : null,
        fillSize: r.fillSize ? Number(r.fillSize) : null,
        executedAt: r.executedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString()
      }))
    };
  });
}

async function main(): Promise<void> {
  await createService({
    name: "execution",
    env,
    routes,
    ready: async () => {
      try {
        await db.query.orders.findFirst();
        return { ok: true };
      } catch (error) {
        return { ok: false, details: { database: String(error) } };
      }
    },
    closers: [close]
  });
}

void main();
