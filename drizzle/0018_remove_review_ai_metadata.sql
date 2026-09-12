ALTER TABLE "review_records"
  DROP COLUMN IF EXISTS "ai_summary",
  DROP COLUMN IF EXISTS "ai_taxonomy_version";
