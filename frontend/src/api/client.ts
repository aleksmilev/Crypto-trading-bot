import { API_BASE_URL } from "../config";

export interface HealthResponse {
  status: "ok" | "degraded";
  postgres: "ok" | "error";
  redis: "ok" | "error";
  tradingEnabled: boolean;
  tradingMode: "shadow" | "paper" | "live";
}

export interface QueueStatus {
  name: string;
  counts: Record<string, number>;
}

export interface CredentialField {
  label: string;
  value: string;
}

export interface AdminTool {
  id: string;
  name: string;
  description: string;
  url: string;
  hint?: string;
  credentials?: CredentialField[];
}

export interface SystemStatus {
  appName: string;
  nodeEnv: string;
  tradingEnabled: boolean;
  tradingMode: "shadow" | "paper" | "live";
  testRoutesEnabled: boolean;
  adminUiEnabled: boolean;
  adminTools: AdminTool[];
  queues: QueueStatus[];
}

export interface JobEvent {
  id: number;
  service: string;
  queue: string;
  jobName: string;
  jobId: string | null;
  status: string;
  payload: unknown;
  createdAt: string;
}

export type TestJobKind = "market-job" | "ai-job" | "execution-job";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  const body = (await response.json()) as T;

  // /health returns a useful body with 503, so callers get it either way.
  if (!response.ok && response.status !== 503) {
    throw new Error(`${init?.method ?? "GET"} ${path} failed with ${response.status}`);
  }

  return body;
}

export const api = {
  health: () => request<HealthResponse>("/health"),
  systemStatus: () => request<SystemStatus>("/system/status"),
  jobEvents: () => request<{ events: JobEvent[] }>("/test/job-events"),
  enqueueTestJob: (kind: TestJobKind) =>
    request<{ queued: boolean; jobId: string }>(`/test/${kind}`, { method: "POST" })
};
