import type { AiDecision } from "@trading/shared/contracts";
import type { AiProvider, DecideParams } from "./types.js";

export function createStubProvider(): AiProvider {
  return {
    name: "stub",
    model: "n/a",
    async decide({ symbol }: DecideParams): Promise<AiDecision> {
      return {
        action: "none",
        symbol,
        reasoning: "Stub provider always recommends no action."
      };
    }
  };
}
