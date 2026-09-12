ALTER TABLE "review_records"
  DROP COLUMN IF EXISTS "territory",
  DROP COLUMN IF EXISTS "source",
  DROP COLUMN IF EXISTS "quality",
  DROP COLUMN IF EXISTS "observed_at",
  DROP COLUMN IF EXISTS "description";
