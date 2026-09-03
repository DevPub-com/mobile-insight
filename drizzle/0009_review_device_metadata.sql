ALTER TABLE "reviews" ADD COLUMN "device" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "device_metadata" jsonb;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "android_os_version" integer;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "app_version_code" integer;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "reviewer_language" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "thumbs_up_count" integer;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "thumbs_down_count" integer;