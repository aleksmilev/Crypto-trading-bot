import { eq } from "drizzle-orm";
import { db } from "./connection.js";
import { settings } from "./schema/index.js";

export const SETTING_KEYS = {
  liveTradingEnabled: "live_trading_enabled"
} as const;

export async function getSetting(key: string): Promise<unknown> {
  const rows = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);

  return rows[0]?.value;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: new Date() }
    });
}
