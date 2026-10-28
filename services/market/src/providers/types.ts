import type { MarketCandle } from "@trading/shared/contracts";

export interface CollectParams {
  symbol: string;
  limit: number;
  lookbackDays: number;
}

export interface MarketProvider {
  name: string;
  collect(params: CollectParams): Promise<MarketCandle[]>;
}
