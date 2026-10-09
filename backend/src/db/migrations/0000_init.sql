CREATE SCHEMA IF NOT EXISTS "config";
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS "trading";
--> statement-breakpoint
CREATE TABLE "config"."settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trading"."job_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"service" text NOT NULL,
	"queue" text NOT NULL,
	"job_name" text NOT NULL,
	"job_id" text,
	"status" text NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "job_events_created_at_idx" ON "trading"."job_events" USING btree ("created_at");