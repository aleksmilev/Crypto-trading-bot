import { z } from "zod";
import type { AiDecision } from "@trading/shared/contracts";
import { aiDecisionSchema } from "@trading/shared/contracts";
import { env } from "../env.js";
import type { AiProvider, DecideParams } from "./types.js";

const openAiResponseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string()
      })
    })
  )
});

export function createOpenAiProvider(): AiProvider {
  if (!env.AI_API_KEY) {
    throw new Error("AI_API_KEY is required for the openai provider");
  }

  return {
    name: "openai",
    model: env.AI_MODEL ?? "gpt-4o-mini",
    async decide({ symbol, features }: DecideParams): Promise<AiDecision> {
      const prompt = `You are a quantitative crypto trading assistant.
Symbol: ${symbol}
Latest indicator snapshot: ${JSON.stringify(features, null, 2)}

Respond ONLY with a JSON object matching this schema:
{
  "action": "none" | "buy" | "sell",
  "symbol": "${symbol}",
  "size": <positive number or omitted>,
  "reasoning": "short explanation"
}
`;

      const response = await fetch(`${env.AI_API_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.AI_API_KEY}`
        },
        body: JSON.stringify({
          model: env.AI_MODEL ?? "gpt-4o-mini",
          messages: [
            { role: "system", content: "You output valid JSON only." },
            { role: "user", content: prompt }
          ],
          temperature: 0.2
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API failed: ${response.status} ${await response.text()}`);
      }

      const data = openAiResponseSchema.parse(await response.json());
      const content = data.choices[0]?.message.content ?? "{}";
      const cleaned = content.replace(/^```json\s*|\s*```$/g, "").trim();
      const parsed = JSON.parse(cleaned);

      return aiDecisionSchema.parse({
        ...parsed,
        symbol: parsed.symbol ?? symbol
      });
    }
  };
}
