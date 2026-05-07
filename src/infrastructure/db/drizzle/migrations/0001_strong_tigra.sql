ALTER TABLE "drawings" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "drawings" ADD COLUMN "failed_at" timestamp with time zone;