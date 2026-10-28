import type { FastifyInstance, FastifyRequest } from "fastify";

export interface AllowlistOptions {
  allowedCidrs: string[];
  forbiddenMessage?: string;
}

function ipToLong(ip: string): number {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some(n => Number.isNaN(n) || n < 0 || n > 255)) {
    return NaN;
  }
  return parts.reduce((acc, part) => (acc << 8) | part, 0) >>> 0;
}

function cidrToRange(cidr: string): { start: number; end: number } | null {
  const [ip, prefix] = cidr.split("/");
  const prefixBits = Number(prefix);
  const base = ipToLong(ip);
  if (Number.isNaN(base) || Number.isNaN(prefixBits) || prefixBits < 0 || prefixBits > 32) {
    return null;
  }
  const mask = (0xffffffff << (32 - prefixBits)) >>> 0;
  const start = (base & mask) >>> 0;
  const end = (start + (1 << (32 - prefixBits)) - 1) >>> 0;
  return { start, end };
}

function isIpAllowed(ip: string, cidrs: string[]): boolean {
  const long = ipToLong(ip);
  if (Number.isNaN(long)) return false;

  return cidrs.some(cidr => {
    if (!cidr.includes("/")) {
      return ipToLong(cidr) === long;
    }
    const range = cidrToRange(cidr);
    if (!range) return false;
    return long >= range.start && long <= range.end;
  });
}

export function getClientIp(request: FastifyRequest): string {
  return (
    (request.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
    request.ip ??
    ""
  );
}

export function registerAllowlist(app: FastifyInstance, options: AllowlistOptions): void {
  const message = options.forbiddenMessage ?? "Forbidden";

  app.addHook("onRequest", async (request, reply) => {
    const ip = getClientIp(request);

    if (!ip || !isIpAllowed(ip, options.allowedCidrs)) {
      request.log.warn({ ip }, "Request rejected by allowlist");
      return reply.code(403).send({ error: message });
    }
  });
}
