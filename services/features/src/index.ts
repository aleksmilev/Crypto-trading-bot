import { eq, desc } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import * as schema from "@trading/db/schema";
import { createDatabase } from "@trading/shared/db";
import { createLogger } from "@trading/shared/logger";
import { createService, getInstanceId, isManagerRequest } from "@trading/shared/service";
import {
  featuresComputeCommandSchema,
  featuresComputeResponseSchema
} from "@trading/shared/contracts";
import { env } from "./env.js";

const instance = getInstanceId("features");
const logger = createLogger({
  service: "features",
  appName: env.APP_NAME,
  env: env.NODE_ENV,
  level: env.LOG_LEVEL,
  instance
});

const { db, close } = createDatabase(env.DATABASE_URL, schema, logger);

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = mean(values.map(v => (v - m) ** 2));
  return Math.sqrt(variance);
}

function sma(values: number[], period: number): number {
  if (values.length < period) return values[values.length - 1] ?? 0;
  return mean(values.slice(-period));
}

function ema(values: number[], period: number): number {
  if (values.length === 0) return 0;
  const k = 2 / (period + 1);
  return values.reduce((acc, price) => (acc == null ? price : price * k + acc * (1 - k)), values[0]);
}

function rsi(closes: number[], period = 14): number {
  if (closes.length <= period) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[closes.length - i] - closes[closes.length - i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

async function computeForRun(runId: string): Promise<{ symbol: string; features: Record<string, number> }> {
  const collection = await db
    .select()
    .from(schema.collections)
    .where(eq(schema.collections.runId, runId))
    .limit(1);

  if (collection.length === 0) {
    throw new Error(`No market collection found for run ${runId}`);
  }

  const symbols = collection[0].symbol.split(",").map(s => s.trim());
  const symbol = symbols[0] ?? env.DEFAULT_SYMBOL;

  const rows = await db
    .select()
    .from(schema.candles)
    .where(eq(schema.candles.symbol, symbol))
    .orderBy(desc(schema.candles.time))
    .limit(200);

  const candles = rows.reverse();
  const closes = candles.map(c => Number(c.close));

  if (closes.length < 2) {
    return { symbol, features: {} };
  }

  const returns = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }

  const features: Record<string, number> = {
    lastReturn: returns[returns.length - 1],
    volatility: stdDev(returns),
    sma20: sma(closes, 20),
    ema12: ema(closes, 12),
    rsi14: rsi(closes, 14),
    price: closes[closes.length - 1]
  };

  return { symbol, features };
}

async function routes(app: FastifyInstance): Promise<void> {
  app.post("/commands/compute", async (request, reply) => {
    if (!isManagerRequest(request, env.MANAGER_IP)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const parsed = featuresComputeCommandSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.message });
    }

    const { runId } = parsed.data;

    const existing = await db
      .select()
      .from(schema.snapshots)
      .where(eq(schema.snapshots.runId, runId))
      .limit(1);

    if (existing.length > 0) {
      return featuresComputeResponseSchema.parse({
        runId,
        status: "computed",
        symbol: existing[0].symbol,
        features: existing[0].features as Record<string, number>,
        computedAt: existing[0].computedAt.toISOString()
      });
    }

    const { symbol, features } = await computeForRun(runId);
    const now = new Date();

    await db.insert(schema.snapshots).values({
      runId,
      symbol,
      features,
      computedAt: now
    });

    return featuresComputeResponseSchema.parse({
      runId,
      status: "computed",
      symbol,
      features,
      computedAt: now.toISOString()
    });
  });

  app.get("/queries/latest", async () => {
    const latest = await db
      .select()
      .from(schema.snapshots)
      .orderBy(desc(schema.snapshots.computedAt))
      .limit(1);

    return {
      latest: latest[0] ?? null
    };
  });
}

async function main(): Promise<void> {
  await createService({
    name: "features",
    env,
    routes,
    ready: async () => {
      try {
        await db.query.snapshots.findFirst();
        return { ok: true };
      } catch (error) {
        return { ok: false, details: { database: String(error) } };
      }
    },
    closers: [close]
  });
}

void main();
