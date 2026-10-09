import { useCallback, useEffect, useState } from "react";
import {
  api,
  type HealthResponse,
  type JobEvent,
  type SystemStatus,
  type TestJobKind
} from "../api/client";
import { CopyField } from "../components/CopyField";
import { StatusBadge } from "../components/StatusBadge";
import { STATUS_REFRESH_INTERVAL_MS } from "../config";

const TEST_JOBS: { kind: TestJobKind; label: string }[] = [
  { kind: "market-job", label: "Market job" },
  { kind: "ai-job", label: "AI job" },
  { kind: "execution-job", label: "Execution job" }
];

export function SystemPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [nextHealth, nextStatus] = await Promise.all([api.health(), api.systemStatus()]);
      setHealth(nextHealth);
      setStatus(nextStatus);

      if (nextStatus.testRoutesEnabled) {
        setEvents((await api.jobEvents()).events);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), STATUS_REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const enqueue = async (kind: TestJobKind) => {
    try {
      await api.enqueueTestJob(kind);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <main className="page">
      <header className="page-header">
        <h1>{status?.appName ?? "AI Trading Bot"}</h1>
        <p className="muted">Infrastructure status</p>
      </header>

      {error && <div className="alert">API unreachable: {error}</div>}

      <section className="card">
        <h2>Services</h2>
        <div className="badges">
          <StatusBadge label="API" ok={health !== null} />
          <StatusBadge label="PostgreSQL" ok={health?.postgres === "ok"} />
          <StatusBadge label="Redis" ok={health?.redis === "ok"} />
          <StatusBadge
            label="Trading"
            ok={!health?.tradingEnabled}
            value={health ? (health.tradingEnabled ? "enabled" : "disabled") : "unknown"}
          />
          <StatusBadge
            label="Mode"
            ok={health?.tradingMode !== "live"}
            value={health?.tradingMode ?? "unknown"}
          />
        </div>
      </section>

      {status?.adminUiEnabled && status.adminTools.length > 0 && (
        <section className="card">
          <h2>Admin tools</h2>
          <p className="muted section-note">
            Development only — credentials are shown because ENABLE_ADMIN_UI is on.
          </p>
          <div className="admin-tools">
            {status.adminTools.map(tool => (
              <div key={tool.id} className="admin-tool">
                <div className="admin-tool-header">
                  <div>
                    <span className="admin-link-name">{tool.name}</span>
                    <span className="admin-link-desc">{tool.description}</span>
                  </div>
                  <a className="admin-open" href={tool.url} target="_blank" rel="noreferrer">
                    Open
                  </a>
                </div>
                {tool.credentials && tool.credentials.length > 0 && (
                  <div className="credential-list">
                    {tool.credentials.map(field => (
                      <CopyField key={field.label} label={field.label} value={field.value} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <h2>Queues</h2>
        <table>
          <thead>
            <tr>
              <th>Queue</th>
              <th>Waiting</th>
              <th>Active</th>
              <th>Delayed</th>
              <th>Completed</th>
              <th>Failed</th>
            </tr>
          </thead>
          <tbody>
            {status?.queues.map(queue => (
              <tr key={queue.name}>
                <td>{queue.name}</td>
                <td>{queue.counts.waiting ?? 0}</td>
                <td>{queue.counts.active ?? 0}</td>
                <td>{queue.counts.delayed ?? 0}</td>
                <td>{queue.counts.completed ?? 0}</td>
                <td>{queue.counts.failed ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {status?.testRoutesEnabled && (
        <section className="card">
          <h2>Pipeline test</h2>
          <div className="actions">
            {TEST_JOBS.map(job => (
              <button key={job.kind} onClick={() => void enqueue(job.kind)}>
                Enqueue {job.label}
              </button>
            ))}
          </div>

          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Service</th>
                <th>Queue</th>
                <th>Job</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {events.map(event => (
                <tr key={event.id}>
                  <td>{new Date(event.createdAt).toLocaleTimeString()}</td>
                  <td>{event.service}</td>
                  <td>{event.queue}</td>
                  <td>
                    {event.jobName} #{event.jobId}
                  </td>
                  <td>{event.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
