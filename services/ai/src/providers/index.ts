import { env } from "../env.js";
import { createOpenAiProvider } from "./openai.js";
import { createStubProvider } from "./stub.js";
import type { AiProvider } from "./types.js";

export function createProvider(): AiProvider {
  switch (env.AI_PROVIDER) {
    case "openai":
      return createOpenAiProvider();
    case "stub":
    default:
      return createStubProvider();
  }
}

export type { AiProvider };
