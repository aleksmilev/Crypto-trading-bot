import { z } from "zod";
import { parseEnvOrExit } from "./parse.js";

// Only the execution worker may import this module; it is the sole holder of broker trade credentials.
const executionEnvSchema = z.object({
  BROKER_API_URL: z.url(),
  BROKER_API_KEY: z.string().min(1),
  BROKER_API_SECRET: z.string().min(1)
});

export type ExecutionEnv = z.infer<typeof executionEnvSchema>;

export function loadExecutionEnv(): ExecutionEnv {
  return parseEnvOrExit(executionEnvSchema, process.env, "execution");
}
