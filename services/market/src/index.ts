import { eq, desc } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import * as schema from "@trading/db/schema";
import { createDatabase } from "@trading/shared/db";
import { createLogger } from "@trading/shared/logger";
import { createService, getInstanceId, isManagerRequest } from "@trading/shared/service";
import {
  marketCandleSchema,
  marketCollectCommandSchema,
  marketCollectResponseSchema,
  type MarketCandle
} from "@trading/shared/contracts";
import { z } from "zod";
import { env } from "./env.js";
import { createProvider } from "./providers/index.js";

const provider = createProvider();
const instance = getInstanceId("market");
const logger = createLogger({
  service: "market",
  appName: env.APP_NAME,
  env: env.NODE_ENV,
  level: env.LOG_LEVEL,
  instance
});

const { db, close } = createDatabase(env.DATABASE_URL, schema, logger);

function parseSymbols(input?: string): string[] {
  return input
    ? input.split(",").map(s => s.trim().toUpperCase())
    : env.SYMBOLS.split(",").map(s => s.trim().toUpperCase());
}

async function routes(app: FastifyInstance): Promise<void> {
  app.post("/commands/collect", async (request, reply) => {
    if (!isManagerRequest(request, env.MANAGER_IP)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const parsed = marketCollectCommandSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.message });
    }

    const { runId, symbols: requestedSymbols } = parsed.data;
    const symbols = requestedSymbols?.length ? requestedSymbols : parseSymbols();

    const existing = await db
      .select()
      .from(schema.collections)
      .where(eq(schema.collections.runId, runId))
      .limit(1);

    if (existing.length > 0) {
      return marketCollectResponseSchema.parse({
        runId,
        status: "skipped",
        symbols,
        candleCount: existing[0].candleCount,
        earliestAt: existing[0].earliestAt?.toISOString(),
        latestAt: existing[0].latestAt?.toISOString(),
        message: "Collection already exists for this run"
      });
    }

    const allCandles: MarketCandle[] = [];
    let totalCount = 0;
    let earliestAt: Date | undefined;
    let latestAt: Date | undefined;

    for (const symbol of symbols) {
      const candles = await provider.collect({
        symbol,
        limit: env.CANDLE_LIMIT,
        lookbackDays: env.LOOKBACK_DAYS
      });

      for (const c of candles) {
        const validated = marketCandleSchema.parse(c);
        const time = new Date(validated.timestamp);
        await db
          .insert(schema.candles)
          .values({
            symbol: validated.symbol,
            time,
            open: String(validated.open),
            high: String(validated.high),
            low: String(validated.low),
            close: String(validated.close),
            volume: String(validated.volume)
          })
          .onConflictDoNothing();

        allCandles.push(validated);
        totalCount++;
        if (!earliestAt || time < earliestAt) earliestAt = time;
        if (!latestAt || time > latestAt) latestAt = time;
      }
    }

    await db.insert(schema.collections).values({
      runId,
      symbol: symbols.join(","),
      candleCount: totalCount,
      earliestAt,
      latestAt
    });

    return marketCollectResponseSchema.parse({
      runId,
      status: "collected",
      symbols,
      candleCount: totalCount,
      earliestAt: earliestAt?.toISOString(),
      latestAt: latestAt?.toISOString()
    });
  });

  app.get("/queries/latest", async () => {
    const latest = await db
      .select()
      .from(schema.collections)
      .orderBy(desc(schema.collections.createdAt))
      .limit(1);

    return {
      latest: latest[0] ?? null
    };
  });

  app.get("/queries/candles", async (request, reply) => {
    const query = z
      .object({
        symbol: z.string().min(1),
        limit: z.coerce.number().int().positive().default(100)
      })
      .safeParse(request.query);

    if (!query.success) {
      return reply.code(400).send({ error: query.error.message });
    }

    const { symbol, limit } = query.data;

    const rows = await db
      .select()
      .from(schema.candles)
      .where(eq(schema.candles.symbol, symbol.toUpperCase()))
      .orderBy(desc(schema.candles.time))
      .limit(limit);

    return {
      symbol: symbol.toUpperCase(),
      candles: rows.reverse().map(r => ({
        symbol: r.symbol,
        timestamp: r.time.toISOString(),
        open: Number(r.open),
        high: Number(r.high),
        low: Number(r.low),
        close: Number(r.close),
        volume: Number(r.volume)
      }))
    };
  });
}

async function main(): Promise<void> {
  await createService({
    name: "market",
    env,
    routes,
    ready: async () => {
      try {
        await db.query.candles.findFirst();
        return { ok: true };
      } catch (error) {
        return { ok: false, details: { database: String(error) } };
      }
    },
    closers: [close]
  });
}

void main();
