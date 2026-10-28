import { randomUUID } from "node:crypto";
import type { MarketCandle } from "@trading/shared/contracts";
import type { CollectParams, MarketProvider } from "./types.js";

export function createStubProvider(): MarketProvider {
  return {
    name: "stub",
    async collect({ symbol, limit }: CollectParams): Promise<MarketCandle[]> {
      const now = Date.now();
      const intervalMs = 60_000;
      const candles: MarketCandle[] = [];
      let price = symbol.includes("BTC") ? 70_000 : 3_000;

      for (let i = limit; i > 0; i--) {
        const open = price;
        const change = (Math.random() - 0.5) * price * 0.002;
        const close = open + change;
        const high = Math.max(open, close) + Math.random() * price * 0.001;
        const low = Math.min(open, close) - Math.random() * price * 0.001;
        const volume = Math.random() * 100;

        candles.push({
          symbol,
          timestamp: new Date(now - i * intervalMs).toISOString(),
          open,
          high,
          low,
          close,
          volume
        });

        price = close;
      }

      return candles;
    }
  };
}
