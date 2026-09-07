ALTER TYPE "sync_type" ADD VALUE IF NOT EXISTS 'stability';--> statement-breakpoint
ALTER TYPE "sync_type" ADD VALUE IF NOT EXISTS 'distribution';--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "android_distribution_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" uuid NOT NULL,
	"platform" "platform" DEFAULT 'android' NOT NULL,
	"country_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rest_of_world" boolean DEFAULT false NOT NULL,
	"device_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" "metric_source" NOT NULL,
	"quality" "metric_quality" NOT NULL,
	"observed_at" timestamp (0) with time zone NOT NULL,
	"created_at" timestamp (0) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (0) with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "android_distribution_snapshots" ADD CONSTRAINT "android_distribution_snapshots_app_id_app_master_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app_master"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "android_distribution_snapshots_app_platform_uidx" ON "android_distribution_snapshots" USING btree ("app_id","platform");
