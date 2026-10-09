-- Runs only on first initialization of the postgres_data volume.
-- Tables are managed by Drizzle migrations (backend/src/db/migrations).

CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE SCHEMA IF NOT EXISTS config;

CREATE SCHEMA IF NOT EXISTS trading;
