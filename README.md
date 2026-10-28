# AI Trading Bot

Locally hosted, AI-assisted trading platform built as one-image-per-service REST microservices.

The AI proposes, a deterministic risk engine validates, and only the isolated execution worker can talk to the broker.

## Services

| Service | Responsibility | Secrets |
|---------|----------------|---------|
| `gateway` | Browser entry; proxies reads to workers and cycle starts to manager | none |
| `manager` | Scheduler and workflow orchestrator; owns run/step audit log | none |
| `market` | Pull and store OHLCV candles | market API key (if any) |
| `features` | Compute indicators from candles | none |
| `ai` | Build structured trade proposal from features | AI API key |
| `risk` | Deterministic validation and sizing | none |
| `execution` | Wallet, positions, orders; place trades with broker | broker API key + secret |
| `migrate` | One-shot Drizzle migrations and DB role grants | Postgres superuser |

## Architecture

See [docs/architecture-and-execution.md](docs/architecture-and-execution.md) for the full design.

```text
Browser -> Caddy -> Gateway -> Manager -> Market -> Features -> AI -> Risk -> Execution
                                 |                                    |
                                 v                                    v
                              Postgres                            Broker / LLM
```

## Getting started

```bash
cp .env.example .env                       # shared config
cp .env.db.example .env.db               # per-service DB passwords
cp .env.execution.example .env.execution   # broker credentials
cp .env.ai.example .env.ai               # optional AI key
cp .env.market.example .env.market       # optional market provider key
chmod 600 .env .env.db .env.execution .env.ai .env.market
```

Edit `.env` and set at least:

- `POSTGRES_PASSWORD`
- `GRAFANA_PASSWORD`
- `ALLOWED_CLIENT_IPS` (your PC IP, e.g. `192.168.1.42`)

### Production-style stack

```bash
docker compose up -d --build
```

| URL | What |
|-----|------|
| `http://localhost/` | Frontend via Caddy |
| `http://localhost/api/system/status` | Aggregated service status |
| `http://localhost/api/cycles` | POST to start a cycle |

### Development (hot reload)

```bash
docker compose -f compose.yml -f compose.dev.yml up --build
```

| URL | What |
|-----|------|
| `http://localhost/` | Frontend via Caddy |
| `http://localhost:5173/` | Vite dev server |
| `http://localhost:3000/api/system/status` | Gateway direct |
| `http://localhost:3001` | Grafana |
| `http://localhost:8081` | Adminer (PostgreSQL) |

Adminer login: system **PostgreSQL**, server **postgres**, user **postgres**, password from `.env`, database **trading**.

> `docker compose down -v` deletes all volumes, including market history and trade records.

## Running a cycle

- **Manual:** click "Start cycle" in the frontend Dashboard, or `curl -X POST http://localhost/api/cycles`.
- **Scheduled:** manager runs on `CYCLE_CRON` (default every 5 minutes in `.env`).

In `TRADING_MODE=shadow` (default) the cycle collects market data, computes features, asks AI, validates risk, and skips real execution while recording a `blocked` order for audit.

## Configuration

| Layer | Holds |
|-------|-------|
| `.env` | Shared non-secret config |
| `.env.db` | Per-service database role passwords |
| `.env.execution` / `.env.ai` / `.env.market` | API keys (only the consuming service gets them) |
| `config.settings` | Runtime toggles such as `live_trading_enabled` |

### Trading modes

- `shadow` — execution is always blocked; safe for testing the pipeline.
- `paper` — execution simulates fills through the stub broker.
- `live` — requires `TRADING_ENABLED=true`, `TRADING_MODE=live`, and the database setting `live_trading_enabled = true`.

## Development without Docker (LXC / bare metal)

Each service builds to `dist/` and can be run with Node directly.

1. Install Postgres and create a `trading` database.
2. Run migrations:
   ```bash
   npm install
   npm run build --workspace=@trading/shared --workspace=@trading/db
   DATABASE_URL=postgres://postgres:password@127.0.0.1:5432/trading \
     DB_PASSWORD_MARKET=... DB_PASSWORD_FEATURES=... ... \
     node packages/db/dist/migrate.js
   ```
3. Build all services:
   ```bash
   npm run build
   ```
4. Start each service as its own systemd unit with the env it needs. Example for the market service:
   ```bash
   DATABASE_URL=postgres://trading_market:password@127.0.0.1:5432/trading \
   ALLOWED_CALLER_CIDRS=127.0.0.1,10.0.0.0/24 \
   MANAGER_IP=10.0.0.10 \
   node services/market/dist/index.js
   ```

Set `ALLOWED_CALLER_CIDRS` to the subnet that contains the manager/gateway instead of the Compose `backend-net` subnet.

## Useful commands

```bash
npm run build        # build all packages and services
npm run typecheck    # typecheck all workspaces
npm run dev          # start the development Compose stack
npm run down         # stop the stack
```
