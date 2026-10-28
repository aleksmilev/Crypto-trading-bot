CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE SCHEMA IF NOT EXISTS config;
CREATE SCHEMA IF NOT EXISTS market;
CREATE SCHEMA IF NOT EXISTS features;
CREATE SCHEMA IF NOT EXISTS ai;
CREATE SCHEMA IF NOT EXISTS risk;
CREATE SCHEMA IF NOT EXISTS execution;
CREATE SCHEMA IF NOT EXISTS manager;

CREATE TABLE IF NOT EXISTS config.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS market.candles (
  symbol TEXT NOT NULL,
  time TIMESTAMPTZ NOT NULL,
  open NUMERIC NOT NULL,
  high NUMERIC NOT NULL,
  low NUMERIC NOT NULL,
  close NUMERIC NOT NULL,
  volume NUMERIC NOT NULL,
  PRIMARY KEY (symbol, time)
);

SELECT create_hypertable('market.candles', 'time', if_not_exists => TRUE);

CREATE TABLE IF NOT EXISTS market.collections (
  run_id UUID PRIMARY KEY,
  symbol TEXT NOT NULL,
  candle_count INTEGER NOT NULL DEFAULT 0,
  earliest_at TIMESTAMPTZ,
  latest_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS features.snapshots (
  run_id UUID PRIMARY KEY,
  symbol TEXT NOT NULL,
  features JSONB NOT NULL DEFAULT '{}',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai.decisions (
  run_id UUID PRIMARY KEY,
  action TEXT NOT NULL,
  symbol TEXT NOT NULL,
  size NUMERIC,
  reasoning TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS risk.validations (
  run_id UUID PRIMARY KEY,
  approved BOOLEAN NOT NULL,
  action TEXT NOT NULL,
  symbol TEXT NOT NULL,
  size NUMERIC,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS execution.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL UNIQUE,
  action TEXT NOT NULL,
  symbol TEXT NOT NULL,
  size NUMERIC NOT NULL,
  status TEXT NOT NULL,
  reason TEXT NOT NULL,
  fill_price NUMERIC,
  fill_size NUMERIC,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS execution.balances (
  symbol TEXT PRIMARY KEY,
  amount NUMERIC NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS execution.positions (
  symbol TEXT PRIMARY KEY,
  amount NUMERIC NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS manager.runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_type TEXT NOT NULL,
  trigger TEXT NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  summary JSONB NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS manager.run_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL,
  step TEXT NOT NULL,
  service TEXT NOT NULL,
  instance TEXT NOT NULL,
  status TEXT NOT NULL,
  request JSONB NOT NULL DEFAULT '{}',
  response JSONB NOT NULL DEFAULT '{}',
  duration_ms INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS run_steps_run_id_idx ON manager.run_steps (run_id);
CREATE INDEX IF NOT EXISTS runs_status_started_at_idx ON manager.runs (status, started_at DESC);
