import { z } from "zod";

export const jobSourceSchema = z.enum(["scheduler", "api", "worker"]);

export const marketDataJobSchema = z.object({
  source: jobSourceSchema,
  symbols: z.array(z.string().min(1)).optional()
});

export const featuresJobSchema = z.object({
  source: jobSourceSchema,
  marketJobId: z.string().optional()
});

export const aiAnalysisJobSchema = z.object({
  source: jobSourceSchema
});

export const tradeExecutionJobSchema = z.object({
  source: jobSourceSchema,
  orderRequestId: z.string().optional()
});

export type MarketDataJob = z.infer<typeof marketDataJobSchema>;
export type FeaturesJob = z.infer<typeof featuresJobSchema>;
export type AiAnalysisJob = z.infer<typeof aiAnalysisJobSchema>;
export type TradeExecutionJob = z.infer<typeof tradeExecutionJobSchema>;

export const JOB_NAMES = {
  collectMarketData: "collect-market-data",
  calculateFeatures: "calculate-features",
  runAiAnalysis: "run-ai-analysis",
  executeOrder: "execute-order"
} as const;
