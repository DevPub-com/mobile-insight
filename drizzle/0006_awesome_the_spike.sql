ALTER TABLE "releases" ADD COLUMN "version_codes" jsonb;--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN "build_number" text;--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN "release_method" text;