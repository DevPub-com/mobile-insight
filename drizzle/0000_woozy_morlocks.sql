CREATE TYPE "public"."platform" AS ENUM('android', 'ios');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('running', 'success', 'failed', 'partial');--> statement-breakpoint
CREATE TYPE "public"."sync_type" AS ENUM('downloads', 'ratings', 'reviews', 'releases', 'all');--> statement-breakpoint
CREATE TABLE "apps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"android_package_name" text,
	"ios_app_id" text,
	"ios_bundle_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"date" date NOT NULL,
	"downloads" integer,
	"rating" double precision,
	"rating_count" integer,
	"review_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"version" text NOT NULL,
	"released_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"external_id" text NOT NULL,
	"rating" integer NOT NULL,
	"title" text,
	"content" text NOT NULL,
	"author" text,
	"version" text,
	"reviewed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"sync_type" "sync_type" NOT NULL,
	"status" "sync_status" NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"records_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_metrics" ADD CONSTRAINT "daily_metrics_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "apps_code_uidx" ON "apps" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_metrics_app_platform_date_uidx" ON "daily_metrics" USING btree ("app_id","platform","date");--> statement-breakpoint
CREATE INDEX "daily_metrics_app_date_idx" ON "daily_metrics" USING btree ("app_id","date");--> statement-breakpoint
CREATE INDEX "daily_metrics_app_platform_date_idx" ON "daily_metrics" USING btree ("app_id","platform","date");--> statement-breakpoint
CREATE UNIQUE INDEX "releases_app_platform_version_uidx" ON "releases" USING btree ("app_id","platform","version");--> statement-breakpoint
CREATE INDEX "releases_app_released_at_idx" ON "releases" USING btree ("app_id","released_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_app_platform_external_uidx" ON "reviews" USING btree ("app_id","platform","external_id");--> statement-breakpoint
CREATE INDEX "reviews_app_reviewed_at_idx" ON "reviews" USING btree ("app_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "sync_runs_app_started_at_idx" ON "sync_runs" USING btree ("app_id","started_at");