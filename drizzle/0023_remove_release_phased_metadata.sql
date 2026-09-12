ALTER TABLE "release_summary"
  DROP COLUMN IF EXISTS "rollout_fraction",
  DROP COLUMN IF EXISTS "phased_release_state",
  DROP COLUMN IF EXISTS "phased_release_day";
