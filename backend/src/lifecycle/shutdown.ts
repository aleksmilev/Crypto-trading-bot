import type { Logger } from "../logging/logger.js";

type Closer = () => Promise<unknown>;

const SHUTDOWN_TIMEOUT_MS = 15_000;

export function registerShutdown(log: Logger, closers: Closer[]): void {
  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    log.info({ signal }, "Shutting down");

    const timer = setTimeout(() => {
      log.error("Shutdown timed out, forcing exit");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    timer.unref();

    for (const close of closers) {
      try {
        await close();
      } catch (error) {
        log.error({ err: error }, "Error during shutdown");
      }
    }

    process.exit(0);
  };

  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
}
