ALTER TABLE "review_records" ADD COLUMN IF NOT EXISTS "ai_sentiment" text;--> statement-breakpoint
ALTER TABLE "review_records" ADD COLUMN IF NOT EXISTS "ai_topics" jsonb;--> statement-breakpoint
ALTER TABLE "review_records" ADD COLUMN IF NOT EXISTS "ai_summary" text;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "ai_insights_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" uuid NOT NULL,
	"insight_type" text NOT NULL,
	"cache_key" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp (0) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (0) with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "ai_insights_cache" ADD CONSTRAINT "ai_insights_cache_app_id_app_master_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app_master"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "ai_insights_cache_app_type_key_uidx" ON "ai_insights_cache" USING btree ("app_id","insight_type","cache_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_insights_cache_app_type_idx" ON "ai_insights_cache" USING btree ("app_id","insight_type");
