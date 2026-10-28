import { env } from "../env.js";
import { createBinanceProvider } from "./binance.js";
import { createStubProvider } from "./stub.js";
import type { MarketProvider } from "./types.js";

export function createProvider(): MarketProvider {
  switch (env.MARKET_PROVIDER) {
    case "binance":
      return createBinanceProvider();
    case "stub":
    default:
      return createStubProvider();
  }
}

export type { MarketProvider };
