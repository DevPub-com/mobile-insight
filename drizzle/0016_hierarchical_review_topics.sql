ALTER TABLE "review_records" ADD COLUMN IF NOT EXISTS "ai_topic_paths" jsonb;--> statement-breakpoint
ALTER TABLE "review_records" ADD COLUMN IF NOT EXISTS "ai_taxonomy_version" integer;
