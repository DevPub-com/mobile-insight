ALTER TABLE "daily_metrics" ADD COLUMN IF NOT EXISTS "new_users" integer;
--> statement-breakpoint
ALTER TABLE "daily_metrics" ADD COLUMN IF NOT EXISTS "engaged_sessions" integer;
--> statement-breakpoint
ALTER TABLE "daily_metrics" ADD COLUMN IF NOT EXISTS "average_session_duration" double precision;
--> statement-breakpoint
ALTER TABLE "daily_metrics" ADD COLUMN IF NOT EXISTS "screen_page_views" integer;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_version_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"date" date NOT NULL,
	"app_version" text NOT NULL,
	"active_users" integer DEFAULT 0 NOT NULL,
	"sessions" integer,
	"created_at" timestamp (0) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (0) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "os_version_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"date" date NOT NULL,
	"os_version" text NOT NULL,
	"active_users" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (0) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (0) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "device_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"date" date NOT NULL,
	"device_brand" text NOT NULL,
	"device_model" text NOT NULL,
	"active_users" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (0) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (0) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "regional_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"date" date NOT NULL,
	"country" text NOT NULL,
	"city" text NOT NULL,
	"active_users" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (0) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (0) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app_version_metrics" ADD CONSTRAINT "app_version_metrics_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "os_version_metrics" ADD CONSTRAINT "os_version_metrics_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "device_metrics" ADD CONSTRAINT "device_metrics_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "regional_metrics" ADD CONSTRAINT "regional_metrics_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "app_version_metrics_identity_uidx" ON "app_version_metrics" USING btree ("app_id","platform","date","app_version");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_version_metrics_app_date_idx" ON "app_version_metrics" USING btree ("app_id","date");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "os_version_metrics_identity_uidx" ON "os_version_metrics" USING btree ("app_id","platform","date","os_version");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "os_version_metrics_app_date_idx" ON "os_version_metrics" USING btree ("app_id","date");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "device_metrics_identity_uidx" ON "device_metrics" USING btree ("app_id","platform","date","device_brand","device_model");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "device_metrics_app_date_idx" ON "device_metrics" USING btree ("app_id","date");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "regional_metrics_identity_uidx" ON "regional_metrics" USING btree ("app_id","platform","date","country","city");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "regional_metrics_app_date_idx" ON "regional_metrics" USING btree ("app_id","date");
