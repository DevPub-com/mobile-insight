UPDATE "releases"
SET "build_number" = trim(both '"' from ("version_codes"->>0))
WHERE "build_number" IS NULL AND "version_codes" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "releases" DROP COLUMN IF EXISTS "version_codes";
--> statement-breakpoint
ALTER TABLE "releases" DROP COLUMN IF EXISTS "release_method";
