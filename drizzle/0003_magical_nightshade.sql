ALTER TABLE "daily_metrics" ADD COLUMN "installs" integer;--> statement-breakpoint
ALTER TABLE "daily_metrics" ADD COLUMN "uninstalls" integer;--> statement-breakpoint
ALTER TABLE "daily_metrics" ADD COLUMN "crashes" integer;--> statement-breakpoint
ALTER TABLE "daily_metrics" ADD COLUMN "anrs" integer;--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN "status" text;--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN "track" text;--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN "release_notes" text;--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN "rollout_fraction" double precision;--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN "phased_release_state" text;--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN "phased_release_day" integer;