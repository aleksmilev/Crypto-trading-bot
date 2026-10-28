import type { FastifyInstance } from "fastify";
import { createLogger } from "@trading/shared/logger";
import { createService, getInstanceId } from "@trading/shared/service";
import { env, serviceUrls } from "./env.js";
import { managerStartCycleCommandSchema, managerStartCycleResponseSchema } from "@trading/shared/contracts";

const instance = getInstanceId("gateway");
const logger = createLogger({
  service: "gateway",
  appName: env.APP_NAME,
  env: env.NODE_ENV,
  level: env.LOG_LEVEL,
  instance
});

async function proxyGet(url: string): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  const text = await response.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = { raw: text };
  }
  if (!response.ok) {
    const error = body && typeof body === "object" && "error" in body ? String(body.error) : text;
    throw new Error(`Upstream error ${response.status}: ${error}`);
  }
  return body;
}

async function proxyPost(url: string, body: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000)
  });
  const text = await response.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = { raw: text };
  }
  if (!response.ok) {
    const error = json && typeof json === "object" && "error" in json ? String(json.error) : text;
    throw new Error(`Upstream error ${response.status}: ${error}`);
  }
  return json;
}

async function routes(app: FastifyInstance): Promise<void> {
  app.get("/api/system/status", async () => {
    const services = await Promise.all(
      Object.entries(serviceUrls).map(async ([name, url]) => {
        try {
          const res = await fetch(`${url}/ready`, { signal: AbortSignal.timeout(5_000) });
          const body = (await res.json()) as { ready?: boolean; instance?: string };
          return { service: name, ready: res.ok && body.ready === true, instance: body.instance ?? "unknown" };
        } catch {
          return { service: name, ready: false, instance: "unknown" };
        }
      })
    );

    return {
      appName: env.APP_NAME,
      env: env.NODE_ENV,
      services
    };
  });

  app.post("/api/cycles", async (request, reply) => {
    const parsed = managerStartCycleCommandSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.message });
    }

    const result = await proxyPost(`${env.MANAGER_URL}/commands/cycles`, parsed.data);
    return managerStartCycleResponseSchema.parse(result);
  });

  app.get("/api/:service/:view", async (request, reply) => {
    const params = request.params as { service: string; view: string };
    const url = serviceUrls[params.service];
    if (!url) {
      return reply.code(404).send({ error: "Unknown service" });
    }

    const query = new URLSearchParams(request.query as Record<string, string>);
    const target = `${url}/queries/${params.view}${query.toString() ? `?${query.toString()}` : ""}`;

    try {
      const result = await proxyGet(target);
      return result;
    } catch (error) {
      return reply.code(502).send({ error: String(error) });
    }
  });
}

async function main(): Promise<void> {
  await createService({
    name: "gateway",
    env: {
      APP_NAME: env.APP_NAME,
      NODE_ENV: env.NODE_ENV,
      LOG_LEVEL: env.LOG_LEVEL,
      API_PORT: env.API_PORT,
      ALLOWED_CALLER_CIDRS: env.ALLOWED_CALLER_CIDRS
    },
    routes,
    ready: async () => ({ ok: true })
  });
}

void main();
