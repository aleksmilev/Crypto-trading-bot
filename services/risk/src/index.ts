import { eq, desc, and, gte, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import * as schema from "@trading/db/schema";
import { createDatabase } from "@trading/shared/db";
import { createLogger } from "@trading/shared/logger";
import { createService, getInstanceId, isManagerRequest } from "@trading/shared/service";
import {
  riskValidateCommandSchema,
  riskValidateResponseSchema,
  type Action
} from "@trading/shared/contracts";
import { env } from "./env.js";

const instance = getInstanceId("risk");
const logger = createLogger({
  service: "risk",
  appName: env.APP_NAME,
  env: env.NODE_ENV,
  level: env.LOG_LEVEL,
  instance
});

const { db, close } = createDatabase(env.DATABASE_URL, schema, logger);

async function getConfig<T>(key: string, fallback: T): Promise<T> {
  const row = await db
    .select({ value: schema.settings.value })
    .from(schema.settings)
    .where(eq(schema.settings.key, key))
    .limit(1);
  return (row[0]?.value as T) ?? fallback;
}

async function validateDecision(runId: string): Promise<{
  approved: boolean;
  action: Action;
  symbol: string;
  size?: number;
  reason: string;
}> {
  const decision = await db
    .select()
    .from(schema.decisions)
    .where(eq(schema.decisions.runId, runId))
    .limit(1);

  if (decision.length === 0) {
    return {
      approved: false,
      action: "none",
      symbol: "",
      reason: "No AI decision found for this run"
    };
  }

  const d = decision[0];
  const action = d.action as Action;
  const symbol = d.symbol;
  const size = d.size ? Number(d.size) : undefined;

  if (action === "none") {
    return { approved: true, action, symbol, reason: "No trade requested" };
  }

  const whitelist = await getConfig<string>("risk_symbol_whitelist", env.DEFAULT_SYMBOL);
  const allowed = whitelist.split(",").map(s => s.trim().toUpperCase());
  if (!allowed.includes(symbol.toUpperCase())) {
    return { approved: false, action, symbol, size, reason: `Symbol ${symbol} not in whitelist` };
  }

  if (!size || size <= 0) {
    return { approved: false, action, symbol, size, reason: "Invalid order size" };
  }

  const snapshot = await db
    .select()
    .from(schema.snapshots)
    .where(eq(schema.snapshots.runId, runId))
    .limit(1);

  const price = snapshot[0]?.features ? (snapshot[0].features as Record<string, number>).price ?? 0 : 0;
  const notional = price * size;

  const maxNotional = await getConfig<number>("risk_max_order_notional", 1_000);
  if (notional > maxNotional) {
    return {
      approved: false,
      action,
      symbol,
      size,
      reason: `Order notional ${notional} exceeds max ${maxNotional}`
    };
  }

  const maxOpenPositions = await getConfig<number>("risk_max_open_positions", 5);
  const openPositions = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.positions)
    .where(gte(schema.positions.amount, "0.00000001"));

  if (Number(openPositions[0]?.count ?? 0) >= maxOpenPositions) {
    return {
      approved: false,
      action,
      symbol,
      size,
      reason: `Max open positions ${maxOpenPositions} reached`
    };
  }

  const cooldownSeconds = await getConfig<number>("risk_cooldown_seconds", 60);
  const lastOrder = await db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.status, "executed"))
    .orderBy(desc(schema.orders.executedAt))
    .limit(1);

  if (lastOrder.length > 0 && lastOrder[0].executedAt) {
    const secondsSince = (Date.now() - lastOrder[0].executedAt.getTime()) / 1000;
    if (secondsSince < cooldownSeconds) {
      return {
        approved: false,
        action,
        symbol,
        size,
        reason: `Cooldown active: ${Math.ceil(cooldownSeconds - secondsSince)}s remaining`
      };
    }
  }

  return { approved: true, action, symbol, size, reason: "Risk checks passed" };
}

async function routes(app: FastifyInstance): Promise<void> {
  app.post("/commands/validate", async (request, reply) => {
    if (!isManagerRequest(request, env.MANAGER_IP)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const parsed = riskValidateCommandSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.message });
    }

    const { runId } = parsed.data;

    const existing = await db
      .select()
      .from(schema.validations)
      .where(eq(schema.validations.runId, runId))
      .limit(1);

    if (existing.length > 0) {
      return riskValidateResponseSchema.parse({
        runId,
        status: existing[0].approved ? "approved" : "rejected",
        decision: {
          approved: existing[0].approved,
          action: existing[0].action as Action,
          symbol: existing[0].symbol,
          size: existing[0].size ? Number(existing[0].size) : undefined,
          reason: existing[0].reason
        }
      });
    }

    const decision = await validateDecision(runId);

    await db.insert(schema.validations).values({
      runId,
      approved: decision.approved,
      action: decision.action,
      symbol: decision.symbol,
      size: decision.size ? String(decision.size) : null,
      reason: decision.reason
    });

    return riskValidateResponseSchema.parse({
      runId,
      status: decision.approved ? "approved" : "rejected",
      decision
    });
  });

  app.get("/queries/validations", async () => {
    const rows = await db
      .select()
      .from(schema.validations)
      .orderBy(desc(schema.validations.createdAt))
      .limit(50);

    return {
      validations: rows.map(r => ({
        runId: r.runId,
        approved: r.approved,
        action: r.action,
        symbol: r.symbol,
        size: r.size ? Number(r.size) : null,
        reason: r.reason,
        createdAt: r.createdAt.toISOString()
      }))
    };
  });
}

async function main(): Promise<void> {
  await createService({
    name: "risk",
    env,
    routes,
    ready: async () => {
      try {
        await db.query.validations.findFirst();
        return { ok: true };
      } catch (error) {
        return { ok: false, details: { database: String(error) } };
      }
    },
    closers: [close]
  });
}

void main();
