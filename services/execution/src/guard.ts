import { eq } from "drizzle-orm";
import * as schema from "@trading/db/schema";
import type { Database } from "@trading/shared/db";
import { env } from "./env.js";

export interface ExecutionPermission {
  allowed: boolean;
  reason: string;
}

export async function getExecutionPermission(
  db: Database<typeof schema>["db"]
): Promise<ExecutionPermission> {
  if (!env.TRADING_ENABLED) {
    return { allowed: false, reason: "TRADING_ENABLED is false" };
  }

  if (env.TRADING_MODE === "shadow") {
    return { allowed: false, reason: "TRADING_MODE is shadow" };
  }

  if (env.TRADING_MODE === "live") {
    const row = await db
      .select({ value: schema.settings.value })
      .from(schema.settings)
      .where(eq(schema.settings.key, "live_trading_enabled"))
      .limit(1);

    if (row[0]?.value !== true) {
      return { allowed: false, reason: "live_trading_enabled database setting is not true" };
    }
  }

  return { allowed: true, reason: `TRADING_MODE is ${env.TRADING_MODE}` };
}
