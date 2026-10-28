export interface Portfolio {
  balances: Record<string, number>;
  positions: Record<string, number>;
}

export interface BrokerProvider {
  name: string;
  submitOrder(params: {
    action: "buy" | "sell";
    symbol: string;
    size: number;
    runId: string;
  }): Promise<{ fillPrice: number; fillSize: number }>;
  syncPortfolio(): Promise<Portfolio>;
}
