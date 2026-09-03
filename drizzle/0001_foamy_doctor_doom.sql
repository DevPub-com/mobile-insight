ALTER TABLE "apps" ALTER COLUMN "created_at" SET DATA TYPE timestamp (0) with time zone;--> statement-breakpoint
ALTER TABLE "apps" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "apps" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (0) with time zone;--> statement-breakpoint
ALTER TABLE "apps" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "daily_metrics" ALTER COLUMN "created_at" SET DATA TYPE timestamp (0) with time zone;--> statement-breakpoint
ALTER TABLE "daily_metrics" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "daily_metrics" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (0) with time zone;--> statement-breakpoint
ALTER TABLE "daily_metrics" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "releases" ALTER COLUMN "released_at" SET DATA TYPE timestamp (0) with time zone;--> statement-breakpoint
ALTER TABLE "releases" ALTER COLUMN "created_at" SET DATA TYPE timestamp (0) with time zone;--> statement-breakpoint
ALTER TABLE "releases" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "releases" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (0) with time zone;--> statement-breakpoint
ALTER TABLE "releases" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "reviewed_at" SET DATA TYPE timestamp (0) with time zone;--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "created_at" SET DATA TYPE timestamp (0) with time zone;--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (0) with time zone;--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sync_runs" ALTER COLUMN "started_at" SET DATA TYPE timestamp (0) with time zone;--> statement-breakpoint
ALTER TABLE "sync_runs" ALTER COLUMN "started_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sync_runs" ALTER COLUMN "finished_at" SET DATA TYPE timestamp (0) with time zone;--> statement-breakpoint
ALTER TABLE "sync_runs" ALTER COLUMN "created_at" SET DATA TYPE timestamp (0) with time zone;--> statement-breakpoint
ALTER TABLE "sync_runs" ALTER COLUMN "created_at" SET DEFAULT now();