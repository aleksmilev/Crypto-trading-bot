import { z, type ZodType } from "zod";

export interface HttpClientOptions {
  baseUrl: string;
  timeoutMs: number;
}

export interface HttpClient {
  post<TResponse>(path: string, body: unknown, responseSchema: ZodType<TResponse>): Promise<TResponse>;
  get<TResponse>(path: string, responseSchema: ZodType<TResponse>): Promise<TResponse>;
}

export function createHttpClient(options: HttpClientOptions): HttpClient {
  async function request<TResponse>(
    method: string,
    path: string,
    body: unknown | undefined,
    responseSchema: ZodType<TResponse>
  ): Promise<TResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      const response = await fetch(`${options.baseUrl}${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });

      const text = await response.text();
      let json: unknown;
      try {
        json = text ? JSON.parse(text) : undefined;
      } catch {
        throw new Error(`Invalid JSON from ${method} ${path}: ${text}`);
      }

      if (!response.ok) {
        const error = json && typeof json === "object" && "error" in json ? String(json.error) : text;
        throw new Error(`${method} ${path} failed with ${response.status}: ${error}`);
      }

      const parsed = responseSchema.safeParse(json);
      if (!parsed.success) {
        throw new Error(`Unexpected response from ${method} ${path}: ${z.prettifyError(parsed.error)}`);
      }
      return parsed.data;
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    post: (path, body, responseSchema) => request("POST", path, body, responseSchema),
    get: (path, responseSchema) => request("GET", path, undefined, responseSchema)
  };
}
