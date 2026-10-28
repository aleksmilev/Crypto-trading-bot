import { API_BASE_URL } from "../config";

export interface ServiceReady {
  service: string;
  ready: boolean;
  instance: string;
}

export interface SystemStatus {
  appName: string;
  env: string;
  services: ServiceReady[];
}

export interface Run {
  id: string;
  jobType: string;
  trigger: string;
  status: string;
  error?: string;
  summary: Record<string, unknown>;
  startedAt: string;
  endedAt?: string;
}

export interface RunStep {
  id: string;
  runId: string;
  step: string;
  service: string;
  instance: string;
  status: "ok" | "error";
  request: unknown;
  response: unknown;
  durationMs: number;
  createdAt: string;
}

export interface Summary {
  total: number;
  byStatus: Record<string, number>;
  lastSuccess: string | null;
  tradesToday: number;
}

export interface CandlesView {
  symbol: string;
  candles: Array<{
    timestamp: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  const body = (await response.json()) as T;

  if (!response.ok) {
    const error = body && typeof body === "object" && "error" in body ? String(body.error) : `${response.status}`;
    throw new Error(`${init?.method ?? "GET"} ${path} failed: ${error}`);
  }

  return body;
}

export const api = {
  systemStatus: () => request<SystemStatus>("/system/status"),
  startCycle: () => request<{ runId: string; status: string }>("/cycles", { method: "POST" }),
  runs: (params?: { limit?: number; offset?: number; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.offset) query.set("offset", String(params.offset));
    if (params?.status) query.set("status", params.status);
    return request<{ runs: Run[] }>(`/runs?${query.toString()}`);
  },
  run: (id: string) => request<{ run: Run | null; steps: RunStep[] }>(`/runs/${id}`),
  summary: () => request<Summary>("/summary"),

  marketLatest: () => request<{ latest: unknown }>("/market/latest"),
  marketCandles: (symbol: string, limit = 100) =>
    request<CandlesView>(`/market/candles?symbol=${symbol}&limit=${limit}`),

  featuresLatest: () => request<{ latest: unknown }>("/features/latest"),

  aiDecisions: () => request<{ decisions: unknown[] }>("/ai/decisions"),
  aiLatest: () => request<{ latest: unknown }>("/ai/latest"),

  riskValidations: () => request<{ validations: unknown[] }>("/risk/validations"),

  wallet: () => request<{ balances: Array<{ symbol: string; amount: number }> }>("/execution/wallet"),
  positions: () => request<{ positions: Array<{ symbol: string; amount: number }> }>("/execution/positions"),
  orders: () => request<{ orders: unknown[] }>("/execution/orders")
};
