import type { MarketCandle } from "@trading/shared/contracts";
import type { CollectParams, MarketProvider } from "./types.js";

interface KlineResponse {
  0: number; // open time
  1: string; // open
  2: string; // high
  3: string; // low
  4: string; // close
  5: string; // volume
  6: number; // close time
}

export function createBinanceProvider(): MarketProvider {
  return {
    name: "binance",
    async collect({ symbol, limit, lookbackDays }: CollectParams): Promise<MarketCandle[]> {
      const endTime = Date.now();
      const startTime = endTime - lookbackDays * 24 * 60 * 60 * 1000;
      const url = new URL("https://api.binance.com/api/v3/klines");
      url.searchParams.set("symbol", symbol);
      url.searchParams.set("interval", "1m");
      url.searchParams.set("startTime", String(startTime));
      url.searchParams.set("endTime", String(endTime));
      url.searchParams.set("limit", String(limit));

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Binance klines failed: ${response.status} ${await response.text()}`);
      }

      const data = (await response.json()) as KlineResponse[];

      return data.map(k => ({
        symbol,
        timestamp: new Date(k[0]).toISOString(),
        open: Number(k[1]),
        high: Number(k[2]),
        low: Number(k[3]),
        close: Number(k[4]),
        volume: Number(k[5])
      }));
    }
  };
}
