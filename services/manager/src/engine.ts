import { eq, desc, and, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@trading/db/schema";
import { createHttpClient } from "@trading/shared/http";
import type { Logger } from "@trading/shared/logger";
import {
  marketCollectCommandSchema,
  marketCollectResponseSchema,
  featuresComputeCommandSchema,
  featuresComputeResponseSchema,
  aiDecideCommandSchema,
  aiDecideResponseSchema,
  riskValidateCommandSchema,
  riskValidateResponseSchema,
  executionExecuteCommandSchema,
  executionExecuteResponseSchema,
  executionSyncPortfolioCommandSchema,
  executionSyncPortfolioResponseSchema,
  runStatusSchema,
  type RunStatus
} from "@trading/shared/contracts";
import type { Env } from "./env.js";

interface ServiceClients {
  market: ReturnType<typeof createHttpClient>;
  features: ReturnType<typeof createHttpClient>;
  ai: ReturnType<typeof createHttpClient>;
  risk: ReturnType<typeof createHttpClient>;
  execution: ReturnType<typeof createHttpClient>;
}

export class Engine {
  private clients: ServiceClients;
  private activeRuns = new Set<string>();

  constructor(
    private env: Env,
    private db: NodePgDatabase<typeof schema>,
    private log: Logger
  ) {
    this.clients = {
      market: createHttpClient({ baseUrl: env.MARKET_URL, timeoutMs: env.STEP_TIMEOUT_MS }),
      features: createHttpClient({ baseUrl: env.FEATURES_URL, timeoutMs: env.STEP_TIMEOUT_MS }),
      ai: createHttpClient({ baseUrl: env.AI_URL, timeoutMs: env.STEP_TIMEOUT_MS }),
      risk: createHttpClient({ baseUrl: env.RISK_URL, timeoutMs: env.STEP_TIMEOUT_MS }),
      execution: createHttpClient({ baseUrl: env.EXECUTION_URL, timeoutMs: env.STEP_TIMEOUT_MS })
    };
  }

  async onStartup(): Promise<void> {
    const running = await this.db
      .select()
      .from(schema.runs)
      .where(eq(schema.runs.status, "running"));

    for (const run of running) {
      await this.db
        .update(schema.runs)
        .set({ status: "crashed", endedAt: new Date(), error: "manager_restart" })
        .where(eq(schema.runs.id, run.id));
      this.log.warn({ runId: run.id }, "Marked in-flight run as crashed after manager restart");
    }
  }

  async startCycle(trigger: "manual" | "schedule", symbols?: string[]): Promise<{ runId: string; status: string }> {
    const runId = crypto.randomUUID();

    const existingRunning = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.runs)
      .where(eq(schema.runs.status, "running"));

    if (Number(existingRunning[0]?.count ?? 0) > 0) {
      this.log.info("Skipping scheduled cycle because another trading-cycle is already running");
      return { runId, status: "skipped_overlap" };
    }

    await this.db.insert(schema.runs).values({
      id: runId,
      jobType: "trading-cycle",
      trigger,
      status: "running",
      summary: { symbols: symbols ?? this.env.SYMBOLS.split(",") }
    });

    this.activeRuns.add(runId);

    // Run asynchronously so the HTTP response returns immediately.
    void this.runCycle(runId, symbols).catch(error => {
      this.log.error({ runId, err: error }, "Unhandled cycle error");
    });

    return { runId, status: "started" };
  }

  private async runCycle(runId: string, symbols?: string[]): Promise<void> {
    try {
      const services = [
        { name: "market", url: this.env.MARKET_URL },
        { name: "features", url: this.env.FEATURES_URL },
        { name: "ai", url: this.env.AI_URL },
        { name: "risk", url: this.env.RISK_URL },
        { name: "execution", url: this.env.EXECUTION_URL }
      ];

      const readiness = await Promise.all(
        services.map(async s => {
          try {
            const res = await fetch(`${s.url}/ready`, { signal: AbortSignal.timeout(this.env.STEP_TIMEOUT_MS) });
            return { ...s, ok: res.ok };
          } catch {
            return { ...s, ok: false };
          }
        })
      );

      const notReady = readiness.filter(r => !r.ok);
      if (notReady.length > 0) {
        await this.failRun(runId, "not_ready", `Services not ready: ${notReady.map(n => n.name).join(", ")}`);
        return;
      }

      await this.step(runId, "market.collect", "market", async () =>
        this.clients.market.post(
          "/commands/collect",
          marketCollectCommandSchema.parse({ runId, symbols }),
          marketCollectResponseSchema
        )
      );

      await this.step(runId, "features.compute", "features", async () =>
        this.clients.features.post(
          "/commands/compute",
          featuresComputeCommandSchema.parse({ runId }),
          featuresComputeResponseSchema
        )
      );

      await this.step(runId, "ai.decide", "ai", async () =>
        this.clients.ai.post(
          "/commands/decide",
          aiDecideCommandSchema.parse({ runId }),
          aiDecideResponseSchema
        )
      );

      const riskResult = await this.step(runId, "risk.validate", "risk", async () =>
        this.clients.risk.post(
          "/commands/validate",
          riskValidateCommandSchema.parse({ runId }),
          riskValidateResponseSchema
        )
      );

      if (!riskResult.decision.approved) {
        await this.db
          .update(schema.runs)
          .set({ status: "rejected_by_risk", endedAt: new Date() })
          .where(eq(schema.runs.id, runId));
        this.activeRuns.delete(runId);
        return;
      }

      if (riskResult.decision.action !== "none") {
        await this.step(runId, "execution.execute", "execution", async () =>
          this.clients.execution.post(
            "/commands/execute",
            executionExecuteCommandSchema.parse({ runId }),
            executionExecuteResponseSchema
          )
        );
      }

      await this.step(runId, "execution.sync-portfolio", "execution", async () =>
        this.clients.execution.post(
          "/commands/sync-portfolio",
          executionSyncPortfolioCommandSchema.parse({ runId }),
          executionSyncPortfolioResponseSchema
        )
      );

      await this.db
        .update(schema.runs)
        .set({ status: "completed", endedAt: new Date() })
        .where(eq(schema.runs.id, runId));
    } catch (error) {
      await this.failRun(runId, "failed", String(error));
    } finally {
      this.activeRuns.delete(runId);
    }
  }

  private async step<T>(
    runId: string,
    stepName: string,
    service: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const startedAt = Date.now();
    let response: T;
    try {
      response = await fn();
    } catch (error) {
      await this.db.insert(schema.runSteps).values({
        runId,
        step: stepName,
        service,
        instance: `${service}-manager`,
        status: "error",
        request: {},
        response: { error: String(error) },
        durationMs: Date.now() - startedAt
      });
      throw error;
    }

    await this.db.insert(schema.runSteps).values({
      runId,
      step: stepName,
      service,
      instance: `${service}-manager`,
      status: "ok",
      request: {},
      response: response as Record<string, unknown>,
      durationMs: Date.now() - startedAt
    });

    return response;
  }

  private async failRun(runId: string, status: RunStatus, error: string): Promise<void> {
    await this.db
      .update(schema.runs)
      .set({ status, endedAt: new Date(), error })
      .where(eq(schema.runs.id, runId));
  }

  async getRuns(query: { limit: number; offset: number; status?: RunStatus }): Promise<schema.Run[]> {
    const q = this.db
      .select()
      .from(schema.runs)
      .orderBy(desc(schema.runs.startedAt))
      .limit(query.limit)
      .offset(query.offset);

    if (query.status) {
      return q.where(eq(schema.runs.status, query.status));
    }
    return q;
  }

  async getRun(runId: string): Promise<{ run: schema.Run | null; steps: schema.RunStep[] }> {
    const run = await this.db
      .select()
      .from(schema.runs)
      .where(eq(schema.runs.id, runId))
      .limit(1);

    const steps = await this.db
      .select()
      .from(schema.runSteps)
      .where(eq(schema.runSteps.runId, runId))
      .orderBy(schema.runSteps.createdAt);

    return { run: run[0] ?? null, steps };
  }

  async getSummary(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    lastSuccess: string | null;
    tradesToday: number;
  }> {
    const all = await this.db.select().from(schema.runs);
    const byStatus: Record<string, number> = {};
    for (const r of all) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    }

    const lastSuccess = await this.db
      .select()
      .from(schema.runs)
      .where(eq(schema.runs.status, "completed"))
      .orderBy(desc(schema.runs.endedAt))
      .limit(1);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const executedToday = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.status, "executed"),
          sql`${schema.orders.executedAt} >= ${today.toISOString()}`
        )
      );

    return {
      total: all.length,
      byStatus,
      lastSuccess: lastSuccess[0]?.endedAt?.toISOString() ?? null,
      tradesToday: Number(executedToday[0]?.count ?? 0)
    };
  }
}
