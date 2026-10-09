import { env } from "../config/env.js";
import { getSetting, SETTING_KEYS } from "../db/settings.js";

export interface ExecutionPermission {
  allowed: boolean;
  reason: string;
}

// Live trading needs two independent switches: TRADING_MODE=live in the environment
// and live_trading_enabled=true in the database.
export async function getExecutionPermission(): Promise<ExecutionPermission> {
  if (!env.TRADING_ENABLED) {
    return { allowed: false, reason: "TRADING_ENABLED is false" };
  }

  if (env.TRADING_MODE === "shadow") {
    return { allowed: false, reason: "TRADING_MODE is shadow" };
  }

  if (env.TRADING_MODE === "live") {
    const liveEnabled = await getSetting(SETTING_KEYS.liveTradingEnabled);

    if (liveEnabled !== true) {
      return { allowed: false, reason: "live_trading_enabled database setting is not true" };
    }
  }

  return { allowed: true, reason: `TRADING_MODE is ${env.TRADING_MODE}` };
}
