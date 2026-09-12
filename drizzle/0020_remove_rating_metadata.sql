DROP INDEX IF EXISTS "rating_daily_records_identity_uidx";
--> statement-breakpoint
CREATE UNIQUE INDEX "rating_daily_records_identity_uidx" ON "rating_daily_records" ("app_id", "platform", "date");
--> statement-breakpoint
ALTER TABLE "rating_daily_records"
  DROP COLUMN IF EXISTS "territory",
  DROP COLUMN IF EXISTS "source",
  DROP COLUMN IF EXISTS "quality",
  DROP COLUMN IF EXISTS "observed_at",
  DROP COLUMN IF EXISTS "description";
