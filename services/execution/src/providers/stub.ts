import type { BrokerProvider, Portfolio } from "./types.js";

export function createStubProvider(): BrokerProvider {
  return {
    name: "stub",
    async submitOrder({ action, symbol, size }) {
      const fillPrice = symbol.includes("BTC") ? 70_000 : 3_000;
      return { fillPrice, fillSize: action === "buy" ? size : -size };
    },
    async syncPortfolio() {
      return {
        balances: { USDT: 10_000, BTC: 0.5 },
        positions: { BTC: 0.5 }
      };
    }
  };
}
