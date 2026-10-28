import type { BrokerProvider, Portfolio } from "./types.js";
import { env } from "../env.js";

export function createBinanceProvider(): BrokerProvider {
  if (!env.BROKER_API_KEY || !env.BROKER_API_SECRET) {
    throw new Error("BROKER_API_KEY and BROKER_API_SECRET are required for live Binance execution");
  }

  return {
    name: "binance",
    async submitOrder({ action, symbol, size, runId }) {
      // Placeholder: real implementation needs request signing and test/new order endpoint.
      throw new Error("Binance live order execution not yet implemented");
    },
    async syncPortfolio() {
      // Placeholder.
      return { balances: {}, positions: {} };
    }
  };
}
