ALTER TABLE "reviews" ADD COLUMN "territory" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "source" "metric_source" DEFAULT 'mobile_insight' NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "quality" "metric_quality" DEFAULT 'unavailable' NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "observed_at" timestamp (0) with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "description" text;
