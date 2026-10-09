# AI Trading Bot

Locally hosted, AI-assisted trading platform. The AI proposes, a deterministic risk engine validates, and only the isolated execution worker can talk to the broker.

This repository currently contains the **infrastructure foundation**: every service boots, and jobs flow `API → Redis/BullMQ → workers → PostgreSQL`. Market data, features, AI, risk and broker logic come in later phases.

## Services

| Service | Command | Purpose |
|---|---|---|
| `api` | `dist/api/server.js` | Fastify API, health, status |
| `scheduler` | `dist/scheduler/scheduler.js` | Registers BullMQ job schedulers |
| `market-worker` | `dist/workers/market.worker.js` | `market-data` queue, chains `features` |
| `feature-worker` | `dist/workers/features.worker.js` | `features` queue |
| `ai-worker` | `dist/workers/ai.worker.js` | `ai-analysis` queue |
| `execution-worker` | `dist/workers/execution.worker.js` | `trade-execution` queue, only holder of broker keys |
| `migrate` | `dist/db/migrate.js` | One-shot Drizzle migrations |

All backend services share one image (`backend/Dockerfile`); only the command differs.

## Getting started

```bash
cp .env.example .env                       # set POSTGRES_PASSWORD and GRAFANA_PASSWORD
cp .env.execution.example .env.execution
chmod 600 .env .env.execution
```

Production-style stack:

```bash
docker compose up -d --build
```

Development (hot reload, source mounts, direct ports):

```bash
docker compose -f compose.yml -f compose.dev.yml up --build
```

| URL | What |
|---|---|
| `http://localhost/` | Frontend via Caddy (`HTTP_PORT` to change) |
| `http://localhost/api/health` | API health via Caddy |
| `localhost:3000` | API (dev only) |
| `localhost:5173` | Vite dev server (dev only) |
| `localhost:3001` | Grafana (dev only) |
| `localhost:5432` / `localhost:6379` | PostgreSQL / Redis (dev only) |

> `docker compose down -v` deletes all volumes, including market history and trade records.

## Pipeline smoke test

With `ENABLE_TEST_ROUTES=true`:

```bash
curl -X POST localhost/api/test/market-job      # market-worker → feature-worker
curl -X POST localhost/api/test/ai-job
curl -X POST localhost/api/test/execution-job   # recorded as "blocked" in shadow mode
curl localhost/api/test/job-events
```

The frontend's system page shows the same information.

## Configuration

| Layer | Holds |
|---|---|
| Environment (`.env`, `.env.execution`) | Secrets, service locations, trading mode |
| PostgreSQL (`config` schema) | Runtime settings changed from the UI |
| Source defaults (`backend/src/config/defaults.ts`) | Safe fallbacks only |

Every service validates its environment with Zod on startup and exits if it is invalid.

### Trading modes

`TRADING_ENABLED=false` and `TRADING_MODE=shadow` are the defaults. The execution worker only proceeds when trading is enabled and the mode is `paper` or `live`. Live mode also requires the database setting `config.settings.live_trading_enabled = true`.

## Networks

- `frontend-net`: Caddy, frontend, API, Grafana.
- `backend-net` (internal): PostgreSQL, Redis, all backend services. No internet access.
- `egress-net`: outbound internet for the market, AI and execution workers.

## Database migrations

```bash
cd backend
npm run db:generate   # after editing src/db/schema/*
npm run db:migrate    # applied automatically by the migrate service in Compose
```

## Running outside Docker (LXC)

The code does not depend on container names; point the env at local services:

```env
DATABASE_URL=postgres://trading:password@127.0.0.1:5432/trading
REDIS_URL=redis://127.0.0.1:6379
```

Build with `npm run build` and run each `dist/...` entry point as its own systemd unit.
