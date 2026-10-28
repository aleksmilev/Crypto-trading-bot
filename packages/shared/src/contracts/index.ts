import { z } from "zod";

// Common primitives
export const runIdSchema = z.string().uuid();
export const tradingModeSchema = z.enum(["shadow", "paper", "live"]);
export const actionSchema = z.enum(["none", "buy", "sell"]);

export type TradingMode = z.infer<typeof tradingModeSchema>;
export type Action = z.infer<typeof actionSchema>;

// Market
export const marketCollectCommandSchema = z.object({
  runId: runIdSchema,
  symbols: z.array(z.string().min(1)).optional()
});

export const marketCollectResponseSchema = z.object({
  runId: runIdSchema,
  status: z.enum(["collected", "skipped", "failed"]),
  symbols: z.array(z.string()),
  candleCount: z.number().int().nonnegative(),
  earliestAt: z.string().optional(),
  latestAt: z.string().optional(),
  message: z.string().optional()
});

export const marketCandleSchema = z.object({
  symbol: z.string(),
  timestamp: z.string(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number()
});

export type MarketCollectCommand = z.infer<typeof marketCollectCommandSchema>;
export type MarketCollectResponse = z.infer<typeof marketCollectResponseSchema>;
export type MarketCandle = z.infer<typeof marketCandleSchema>;

// Features
export const featuresComputeCommandSchema = z.object({
  runId: runIdSchema
});

export const featureValueSchema = z.record(z.string(), z.number());

export const featuresComputeResponseSchema = z.object({
  runId: runIdSchema,
  status: z.enum(["computed", "skipped", "failed"]),
  symbol: z.string(),
  features: featureValueSchema,
  computedAt: z.string()
});

export type FeaturesComputeCommand = z.infer<typeof featuresComputeCommandSchema>;
export type FeaturesComputeResponse = z.infer<typeof featuresComputeResponseSchema>;

// AI
export const aiDecideCommandSchema = z.object({
  runId: runIdSchema
});

export const aiDecisionSchema = z.object({
  action: actionSchema,
  symbol: z.string().min(1),
  size: z.number().positive().optional(),
  reasoning: z.string().min(1)
});

export const aiDecideResponseSchema = z.object({
  runId: runIdSchema,
  status: z.enum(["decided", "failed"]),
  decision: aiDecisionSchema,
  provider: z.string(),
  model: z.string().optional()
});

export type AiDecideCommand = z.infer<typeof aiDecideCommandSchema>;
export type AiDecision = z.infer<typeof aiDecisionSchema>;
export type AiDecideResponse = z.infer<typeof aiDecideResponseSchema>;

// Risk
export const riskValidateCommandSchema = z.object({
  runId: runIdSchema
});

export const riskDecisionSchema = z.object({
  approved: z.boolean(),
  action: actionSchema,
  symbol: z.string(),
  size: z.number().positive().optional(),
  reason: z.string()
});

export const riskValidateResponseSchema = z.object({
  runId: runIdSchema,
  status: z.enum(["approved", "rejected", "failed"]),
  decision: riskDecisionSchema
});

export type RiskValidateCommand = z.infer<typeof riskValidateCommandSchema>;
export type RiskDecision = z.infer<typeof riskDecisionSchema>;
export type RiskValidateResponse = z.infer<typeof riskValidateResponseSchema>;

// Execution
export const executionOrderSchema = z.object({
  action: actionSchema,
  symbol: z.string(),
  size: z.number().positive(),
  runId: runIdSchema
});

export const executionExecuteCommandSchema = z.object({
  runId: runIdSchema,
  order: executionOrderSchema.optional()
});

export const executionExecuteResponseSchema = z.object({
  runId: runIdSchema,
  status: z.enum(["executed", "blocked", "already_done", "not_implemented", "failed"]),
  order: executionOrderSchema.optional(),
  reason: z.string(),
  fillPrice: z.number().optional(),
  fillSize: z.number().optional(),
  executedAt: z.string().optional()
});

export const executionSyncPortfolioCommandSchema = z.object({
  runId: runIdSchema
});

export const executionSyncPortfolioResponseSchema = z.object({
  runId: runIdSchema,
  status: z.enum(["synced", "failed"]),
  balances: z.record(z.string(), z.number()).optional(),
  positions: z.record(z.string(), z.number()).optional(),
  syncedAt: z.string().optional()
});

export type ExecutionOrder = z.infer<typeof executionOrderSchema>;
export type ExecutionExecuteCommand = z.infer<typeof executionExecuteCommandSchema>;
export type ExecutionExecuteResponse = z.infer<typeof executionExecuteResponseSchema>;
export type ExecutionSyncPortfolioCommand = z.infer<typeof executionSyncPortfolioCommandSchema>;
export type ExecutionSyncPortfolioResponse = z.infer<typeof executionSyncPortfolioResponseSchema>;

// Manager
export const managerStartCycleCommandSchema = z.object({
  trigger: z.enum(["manual", "schedule"]).default("manual"),
  symbols: z.array(z.string().min(1)).optional()
});

export const managerStartCycleResponseSchema = z.object({
  runId: runIdSchema,
  status: z.enum(["started", "skipped_overlap"])
});

export const runStatusSchema = z.enum([
  "running",
  "not_ready",
  "rejected_by_risk",
  "completed",
  "failed",
  "crashed"
]);

export const runStepSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  step: z.string(),
  service: z.string(),
  instance: z.string(),
  status: z.enum(["ok", "error"]),
  request: z.unknown(),
  response: z.unknown(),
  durationMs: z.number().int().nonnegative(),
  createdAt: z.string()
});

export const runSchema = z.object({
  id: z.string().uuid(),
  jobType: z.string(),
  trigger: z.enum(["manual", "schedule"]),
  status: runStatusSchema,
  error: z.string().optional(),
  summary: z.record(z.string(), z.unknown()),
  startedAt: z.string(),
  endedAt: z.string().optional()
});

export const managerRunsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
  status: runStatusSchema.optional()
});

export type ManagerStartCycleCommand = z.infer<typeof managerStartCycleCommandSchema>;
export type ManagerStartCycleResponse = z.infer<typeof managerStartCycleResponseSchema>;
export type RunStatus = z.infer<typeof runStatusSchema>;
export type Run = z.infer<typeof runSchema>;
export type RunStep = z.infer<typeof runStepSchema>;
export type ManagerRunsQuery = z.infer<typeof managerRunsQuerySchema>;

// Gateway system status
export const serviceReadySchema = z.object({
  service: z.string(),
  ready: z.boolean(),
  instance: z.string()
});

export const systemStatusSchema = z.object({
  appName: z.string(),
  env: z.string(),
  tradingEnabled: z.boolean(),
  tradingMode: tradingModeSchema,
  services: z.array(serviceReadySchema)
});

export type SystemStatus = z.infer<typeof systemStatusSchema>;
