CREATE TYPE "public"."metric_quality" AS ENUM('exact', 'estimated', 'derived', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."metric_source" AS ENUM('google_play_gcs', 'google_play_api', 'google_play_manual_csv', 'app_store_analytics', 'app_store_sales', 'app_store_reviews', 'firebase', 'manual', 'mobile_insight');--> statement-breakpoint
CREATE TABLE "metric_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"date" date NOT NULL,
	"metric_key" text NOT NULL,
	"value" double precision,
	"source" "metric_source" NOT NULL,
	"quality" "metric_quality" NOT NULL,
	"observed_at" timestamp (0) with time zone NOT NULL,
	"description" text,
	"created_at" timestamp (0) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (0) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rating_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"territory" text DEFAULT 'GLOBAL' NOT NULL,
	"date" date NOT NULL,
	"average_rating" double precision NOT NULL,
	"rating_count" integer,
	"source" "metric_source" NOT NULL,
	"quality" "metric_quality" NOT NULL,
	"observed_at" timestamp (0) with time zone NOT NULL,
	"description" text,
	"created_at" timestamp (0) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (0) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "release_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"version" text NOT NULL,
	"version_code" text DEFAULT '' NOT NULL,
	"track" text DEFAULT 'unknown' NOT NULL,
	"observed_on" date NOT NULL,
	"lifecycle_state" text,
	"rollout_fraction" double precision,
	"observed_at" timestamp (0) with time zone NOT NULL,
	"first_seen_published_at" timestamp (0) with time zone,
	"source" "metric_source" NOT NULL,
	"quality" "metric_quality" NOT NULL,
	"description" text,
	"created_at" timestamp (0) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (0) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "metric_observations" ADD CONSTRAINT "metric_observations_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_snapshots" ADD CONSTRAINT "rating_snapshots_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_observations" ADD CONSTRAINT "release_observations_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "metric_observations_identity_uidx" ON "metric_observations" USING btree ("app_id","platform","date","metric_key","source");--> statement-breakpoint
CREATE INDEX "metric_observations_app_date_idx" ON "metric_observations" USING btree ("app_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "rating_snapshots_identity_uidx" ON "rating_snapshots" USING btree ("app_id","platform","territory","date","source");--> statement-breakpoint
CREATE INDEX "rating_snapshots_app_date_idx" ON "rating_snapshots" USING btree ("app_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "release_observations_identity_uidx" ON "release_observations" USING btree ("app_id","platform","version","version_code","track","observed_on","source");--> statement-breakpoint
CREATE INDEX "release_observations_app_date_idx" ON "release_observations" USING btree ("app_id","observed_on");