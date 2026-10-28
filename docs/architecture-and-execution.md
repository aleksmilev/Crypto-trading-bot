# Architecture & product execution

This document is the target architecture for the AI trading bot after a **big-bang** rewrite of the current BullMQ-centric foundation. Development runs on **Docker Compose**; production later moves to **LXC** without redesigning the service boundaries.

## Goals

- One container per service, **one image per service**, same monorepo.
- Each worker exposes a **REST API**; each endpoint does **one action**.
- A **manager** is the only scheduler and the only orchestrator of write workflows.
- Workers never call each other to advance a workflow.
- Least privilege: network, DB rights, and secrets only where required.
- Frontend reads through a **gateway**; manual “run now” goes through the manager.
- Trading safety unchanged: `shadow` / `paper` / `live`, with live requiring env + DB switch.

## Service map (v1)

| Service | Responsibility | Holds secrets | Egress |
|--------|----------------|---------------|--------|
| **gateway** | Browser entry: authz by source IP, proxies **read** APIs, forwards “start cycle” to manager | none | no |
| **manager** | Schedules jobs, runs sequential workflows, persists run/step logs, exposes run status | none | no |
| **market** | Pull market data, store candles, expose last market state | market data API key (if any) | yes |
| **features** | Compute indicators from stored market data, expose latest features | none | no |
| **ai** | Build decision from features, call LLM, return structured proposal | AI provider API key | yes |
| **risk** | Deterministic validation / sizing checks; approve or reject | none | no |
| **execution** (broker / Binance integration) | Wallet, positions, orders; place trades; portfolio sync from broker | broker API key + secret | yes |
| **postgres** | Shared database, schema ownership per service | — | no |
| **prometheus** / **grafana** | Metrics and dashboards | — | as today |

**Open for later (not in v1):** position-sizing as its own service, maintenance, multi-exchange, user auth. Keep Compose/layout ready to add containers.

**Redis / BullMQ:** not part of the workflow. Durable state lives in Postgres (runs/steps). Reintroduce Redis later only if needed for cache or locks.

## Network & access control

Keep three networks:

- **frontend-net** — gateway (and optionally grafana).
- **backend-net** (internal) — all services + Postgres; no internet.
- **egress-net** — market, ai, execution only.

**HTTP allowlists (no user auth in v1):**

- **Gateway:** accept browser traffic only from configured PC IP(s).
- **Internal service APIs:** accept traffic only from other Compose containers (manager, gateway, health scrapers as needed). Worker write endpoints are **not** exposed to the browser.
- Frontend never calls market/features/ai/risk/execution directly in production-style Compose; it uses the **gateway**.

Each service exposes:

- `GET /health` — process up
- `GET /ready` — dependencies OK (DB, upstream API if required)

Manager **does not start a cycle** unless required services report ready.

## Data ownership (one Postgres)

One shared Postgres/Timescale instance. **Table (or schema) ownership:**

| Owner | Examples |
|-------|----------|
| market | candles / OHLCV, market pull metadata |
| features | feature snapshots |
| ai | proposals / decisions |
| risk | validation results |
| execution | orders, fills, wallet/position snapshots |
| manager | `runs`, `run_steps`, crash/cycle summaries |

Only the owning service’s DB role may **WRITE** its tables. Other services get **READ** only where needed (e.g. features reads candles; ai reads features; risk reads proposal; manager writes only run tables). Gateway and frontend never get DB credentials.

## Jobs vs cycles

A **job** is one unit of scheduled or manual work. Steps inside a job run **sequentially**; the manager waits for each step’s HTTP response before the next step of **that** job.

**Different jobs do not wait on each other.** The same cadence may start more than one job type; they can overlap.

### Cadence

One shared interval/cron (same cadence for market-oriented and decision-oriented work). Exact minutes/cron stay in env.

### Job types (v1)

1. **`trading-cycle`** — main decision pipeline (see below).
2. **`portfolio-sync`** (optional companion) — refresh wallet/positions from broker without deciding a trade. Can run without waiting on an in-flight trading-cycle.

Manual UI action: “start a new cycle” → gateway → **manager** `POST /cycles` (or equivalent) → new `trading-cycle` run.

### Crash behavior

If the manager process dies mid-job: **do not resume** that run. On next start, mark the incomplete run as **crashed** (logged for the frontend), then **start a new cycle** on the next schedule or manual trigger.

### Retries

**No retries** at manager or worker level for workflow steps. A failure fails the step, fails the run, and stops that cycle. Execution never auto-retries an order.

## Trading-cycle sequence (happy path)

Manager creates a `run` with a `runId`, then:

1. **Ready check** — required services `/ready`.
2. **Market** `POST …/collect` — pull market state into DB → full payload response; manager logs step.
3. **Features** `POST …/compute` — compute from latest market data → payload logged.
4. **AI** `POST …/decide` — proposal (or “do nothing”) → payload logged.
5. **Risk** `POST …/validate` — approve or reject → payload logged.
6. **Branch**
   - **Risk reject** → **full stop**. No execute, no portfolio sync for this run. Status `rejected_by_risk`.
   - **AI do nothing** (and risk allows no-op / skips trade) → **skip execute**, still **portfolio sync**.
   - **Approved trade** → **Execution** `POST …/execute` with **idempotency key** = `runId` (or `runId:orderIntentHash`) → payload logged.
7. **Portfolio sync** (when not stopped by risk reject) — Execution `POST …/sync-portfolio` (or `GET` refresh that writes snapshots) → wallet/positions updated for UI.

Manager stores each step: service, request summary, full response payload (or agreed important fields), status, timestamps. Frontend reads **aggregate run reports** via gateway → manager.

```text
Schedule / UI
    → Manager
        → Market.collect
        → Features.compute
        → AI.decide
        → Risk.validate
              ├─ reject  → STOP (log run)
              └─ approve
                    ├─ trade    → Execution.execute → Execution.sync
                    └─ do nothing → Execution.sync
```

### Pre-execute rules (defense in depth)

Manager calls execute only if risk approved a trade.

Execution **must still enforce**:

- `TRADING_ENABLED`
- `TRADING_MODE` (`shadow` blocks real/paper submit as today; `paper` / `live` as configured)
- For `live`: DB `live_trading_enabled === true`
- Idempotency: duplicate key → return previous result (`already_done`), never a second order
- Basic sanity: symbol whitelist, non-zero size, etc. (details at implementation time)

Broker credentials exist **only** in the execution container.

## API style

- **REST only.**
- **Commands** (manager → workers): return **full payloads** needed for logging and the next step.
- **Queries** (gateway → workers): read models for the UI.

### Example read paths (via gateway)

| UI need | Upstream |
|---------|----------|
| Last market state / freshness | market |
| Latest features | features |
| Last AI proposal | ai |
| Risk decisions | risk |
| Wallet / positions / open orders | execution |
| Cycle list, step log, crash markers, aggregate report | manager |

### Smoke / test routes

Every worker service keeps explicit **test/smoke** endpoints (dev-flagged), still allowlisted to internal network only.

## Identity & logging

- **`runId`**: UUID created by the manager for each job/cycle; sent on every step call; stored on every `run_steps` row. This is what ties a cycle together in the UI.
- **Instance id**: `{service}-{container_id}` (or Compose service task id) included in logs and optionally in response metadata so operators know which replica answered.
- Prefer structured JSON logs; Prometheus metrics per service; Grafana as today.

## Idempotency

- **Required** on `execution` trade submit.
- **Recommended** on other mutating commands using `runId` so a confused client cannot double-write the same step’s business effect; with **no retries**, this is mainly for crash/manual double-start safety at the edge of each service.

## Frontend

- Looks polished; exact screens are flexible.
- Must show: current/recent **cycles**, step outcomes, crash/aborted runs, aggregate summary; plus market, features, AI, risk, and wallet views fed by the gateway.
- No workflow writes except “ask manager to start a cycle.”

## What we drop vs keep from the old foundation

| Drop / replace | Keep / evolve |
|----------------|---------------|
| BullMQ queues as workflow engine | Compose multi-network least privilege |
| Workers chaining other queues | Trading mode + live DB switch |
| Single shared backend image + command | Postgres + Timescale direction |
| Central “api” as only HTTP surface | Prometheus / Grafana |
| `job_events` as primary audit | Become **runs / run_steps** (richer, UI-facing) |

## Deployment notes

- **Dev:** Docker Compose only; one Dockerfile (or build context) per service under the monorepo.
- **Later:** same processes on LXC; env points at local Postgres; forget Compose-specific hostnames in app code (use config).

## Non-goals (v1)

- Multi-user accounts / OAuth
- Multi-exchange beyond one Binance-style integration
- Resumable in-flight runs after manager crash
- Automatic retries
- DB-per-service

## Decision log (from product Q&A)

| Topic | Decision |
|-------|----------|
| Orchestration | Sequential within a job; parallel across jobs OK |
| Manager crash | Log crash, new cycle next time (no resume) |
| Retries | None |
| Run/step log | Yes, for frontend |
| Manual run | Yes, via manager only |
| Gateway | Yes |
| Auth | None; IP + container allowlists |
| Risk | Own service |
| Market vs features | Separate |
| Wallet | Execution / Binance integration |
| DB | One Postgres; write rights only for owners |
| Secrets | Only in services that call that API; duplicate if two need same key |
| AI do nothing | Still portfolio sync |
| Risk reject | Full stop |
| Cadence | Same for scheduled work |
| Payload | Full (important fields logged) |
| Rewrite | Big-bang; one image per service; same repo |
| Plan scope | Architecture documented here; implementation plan later |
