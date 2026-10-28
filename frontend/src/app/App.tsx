import { useEffect, useState } from "react";
import { api, type Run, type RunStep, type ServiceReady, type Summary } from "../api/client";
import { STATUS_REFRESH_INTERVAL_MS } from "../config";

type Tab = "dashboard" | "cycles" | "market" | "signals" | "risk" | "wallet" | "system";

function StatusBadge({ label, ok, value }: { label: string; ok: boolean; value?: string }) {
  return (
    <div className={`badge ${ok ? "badge-ok" : "badge-error"}`}>
      <span className="badge-label">{label}</span>
      <span className="badge-value">{value ?? (ok ? "ok" : "error")}</span>
    </div>
  );
}

function useIntervalRefresh(ms: number) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), ms);
    return () => clearInterval(timer);
  }, [ms]);
  return tick;
}

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [error, setError] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceReady[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [runDetail, setRunDetail] = useState<{ run: Run | null; steps: RunStep[] } | null>(null);
  const [candles, setCandles] = useState<unknown>(null);
  const [latestMarket, setLatestMarket] = useState<unknown>(null);
  const [latestFeatures, setLatestFeatures] = useState<unknown>(null);
  const [latestAi, setLatestAi] = useState<unknown>(null);
  const [aiDecisions, setAiDecisions] = useState<unknown[]>([]);
  const [validations, setValidations] = useState<unknown[]>([]);
  const [wallet, setWallet] = useState<{ balances: Array<{ symbol: string; amount: number }> } | null>(null);
  const [positions, setPositions] = useState<{ positions: Array<{ symbol: string; amount: number }> } | null>(null);
  const [orders, setOrders] = useState<unknown[]>([]);

  const tick = useIntervalRefresh(STATUS_REFRESH_INTERVAL_MS);

  const handleError = (err: unknown) => {
    setError(err instanceof Error ? err.message : String(err));
  };

  const refreshDashboard = async () => {
    try {
      const [statusRes, summaryRes, runsRes] = await Promise.all([
        api.systemStatus(),
        api.summary(),
        api.runs({ limit: 10 })
      ]);
      setServices(statusRes.services);
      setSummary(summaryRes);
      setRuns(runsRes.runs);
      setError(null);
    } catch (err) {
      handleError(err);
    }
  };

  const startCycle = async () => {
    try {
      await api.startCycle();
      await refreshDashboard();
    } catch (err) {
      handleError(err);
    }
  };

  useEffect(() => {
    void refreshDashboard();
  }, [tick]);

  useEffect(() => {
    if (activeTab === "market") {
      void api.marketLatest().then(setLatestMarket).catch(handleError);
      void api.marketCandles("BTCUSDT").then(setCandles).catch(handleError);
    }
    if (activeTab === "signals") {
      void api.featuresLatest().then(setLatestFeatures).catch(handleError);
      void api.aiLatest().then(setLatestAi).catch(handleError);
      void api.aiDecisions().then(r => setAiDecisions(r.decisions)).catch(handleError);
    }
    if (activeTab === "risk") {
      void api.riskValidations().then(r => setValidations(r.validations)).catch(handleError);
    }
    if (activeTab === "wallet") {
      void api.wallet().then(setWallet).catch(handleError);
      void api.positions().then(setPositions).catch(handleError);
      void api.orders().then(r => setOrders(r.orders)).catch(handleError);
    }
    if (activeTab === "cycles" && selectedRun) {
      void api.run(selectedRun.id).then(setRunDetail).catch(handleError);
    }
  }, [activeTab, selectedRun]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "dashboard", label: "Dashboard" },
    { id: "cycles", label: "Cycles" },
    { id: "market", label: "Market" },
    { id: "signals", label: "Signals" },
    { id: "risk", label: "Risk" },
    { id: "wallet", label: "Wallet" },
    { id: "system", label: "System" }
  ];

  return (
    <div className="page">
      <header className="page-header">
        <h1>AI Trading Bot</h1>
        <p className="muted">Microservices control panel</p>
      </header>

      <nav className="tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            className={activeTab === t.id ? "active" : ""}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {error && <div className="alert">{error}</div>}

      {activeTab === "dashboard" && (
        <>
          <section className="card">
            <div className="actions">
              <button onClick={() => void startCycle()}>Start cycle</button>
            </div>
            <div className="badges">
              {services.map(s => (
                <StatusBadge key={s.service} label={s.service} ok={s.ready} value={s.instance.slice(-12)} />
              ))}
            </div>
          </section>

          <section className="card">
            <h2>Summary</h2>
            {summary && (
              <div className="badges">
                <StatusBadge label="Total runs" ok value={String(summary.total)} />
                <StatusBadge label="Completed" ok value={String(summary.byStatus.completed ?? 0)} />
                <StatusBadge label="Failed" ok={summary.byStatus.failed === 0} value={String(summary.byStatus.failed ?? 0)} />
                <StatusBadge label="Crashed" ok={summary.byStatus.crashed === 0} value={String(summary.byStatus.crashed ?? 0)} />
                <StatusBadge label="Trades today" ok value={String(summary.tradesToday)} />
              </div>
            )}
          </section>

          <section className="card">
            <h2>Recent runs</h2>
            <table>
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Trigger</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {runs.map(run => (
                  <tr key={run.id}>
                    <td>{new Date(run.startedAt).toLocaleString()}</td>
                    <td>{run.trigger}</td>
                    <td>{run.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      {activeTab === "cycles" && (
        <section className="card">
          <div className="split">
            <div className="run-list">
              <h2>Runs</h2>
              <table>
                <thead>
                  <tr>
                    <th>Started</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map(run => (
                    <tr
                      key={run.id}
                      className={selectedRun?.id === run.id ? "selected" : ""}
                      onClick={() => {
                        setSelectedRun(run);
                        void api.run(run.id).then(setRunDetail).catch(handleError);
                      }}
                    >
                      <td>{new Date(run.startedAt).toLocaleString()}</td>
                      <td>{run.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="run-detail">
              <h2>Run detail</h2>
              {runDetail ? (
                <>
                  <p>Status: {runDetail.run?.status}</p>
                  {runDetail.run?.error && <p className="alert">{runDetail.run.error}</p>}
                  <table>
                    <thead>
                      <tr>
                        <th>Step</th>
                        <th>Service</th>
                        <th>Status</th>
                        <th>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {runDetail.steps.map(step => (
                        <tr key={step.id}>
                          <td>{step.step}</td>
                          <td>{step.service}</td>
                          <td>{step.status}</td>
                          <td>{step.durationMs}ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <details>
                    <summary>Raw payloads</summary>
                    <pre>{JSON.stringify(runDetail.steps, null, 2)}</pre>
                  </details>
                </>
              ) : (
                <p className="muted">Select a run</p>
              )}
            </div>
          </div>
        </section>
      )}

      {activeTab === "market" && (
        <section className="card">
          <h2>Market</h2>
          <pre>{JSON.stringify({ latest: latestMarket, candles: (candles as CandlesView)?.candles?.slice(-5) }, null, 2)}</pre>
        </section>
      )}

      {activeTab === "signals" && (
        <section className="card">
          <h2>Signals</h2>
          <h3>Latest features</h3>
          <pre>{JSON.stringify(latestFeatures, null, 2)}</pre>
          <h3>Latest AI decision</h3>
          <pre>{JSON.stringify(latestAi, null, 2)}</pre>
          <h3>Recent decisions</h3>
          <pre>{JSON.stringify(aiDecisions, null, 2)}</pre>
        </section>
      )}

      {activeTab === "risk" && (
        <section className="card">
          <h2>Risk validations</h2>
          <pre>{JSON.stringify(validations, null, 2)}</pre>
        </section>
      )}

      {activeTab === "wallet" && (
        <section className="card">
          <h2>Wallet</h2>
          <pre>{JSON.stringify({ wallet, positions, orders }, null, 2)}</pre>
        </section>
      )}

      {activeTab === "system" && (
        <section className="card">
          <h2>Services</h2>
          <div className="badges">
            {services.map(s => (
              <StatusBadge key={s.service} label={s.service} ok={s.ready} value={s.instance.slice(-12)} />
            ))}
          </div>
          <h3>Admin tools</h3>
          <ul>
            <li><a href="http://localhost:3001" target="_blank" rel="noreferrer">Grafana</a></li>
            <li><a href="http://localhost:8081" target="_blank" rel="noreferrer">Adminer</a></li>
          </ul>
        </section>
      )}
    </div>
  );
}

type CandlesView = { candles: Array<{ timestamp: string; close: number }> };
