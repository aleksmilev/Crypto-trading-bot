import type { AiDecision } from "@trading/shared/contracts";

export interface DecideParams {
  symbol: string;
  features: Record<string, number>;
  runId: string;
}

export interface AiProvider {
  name: string;
  model?: string;
  decide(params: DecideParams): Promise<AiDecision>;
}
