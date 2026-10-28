import { collectDefaultMetrics, Registry } from "prom-client";

export function createMetrics(service: string): Registry {
  const registry = new Registry();
  registry.setDefaultLabels({ service });
  collectDefaultMetrics({ register: registry, prefix: `trading_${service}_` });
  return registry;
}
