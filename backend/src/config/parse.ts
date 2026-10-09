import { z } from "zod";

export function parseEnvOrExit<T extends z.ZodType>(
  schema: T,
  source: NodeJS.ProcessEnv,
  label: string
): z.infer<T> {
  const result = schema.safeParse(source);

  if (!result.success) {
    // The logger depends on validated env, so this has to go straight to stderr.
    console.error(`Invalid ${label} configuration:\n${z.prettifyError(result.error)}`);
    process.exit(1);
  }

  return result.data;
}
