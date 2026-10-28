import { env } from "../env.js";
import { createBinanceProvider } from "./binance.js";
import { createStubProvider } from "./stub.js";
import type { BrokerProvider } from "./types.js";

export function createProvider(): BrokerProvider {
  if (env.TRADING_MODE === "live") {
    return createBinanceProvider();
  }
  return createStubProvider();
}

export type { BrokerProvider };
