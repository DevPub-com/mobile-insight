ALTER TABLE "apps" RENAME TO "app_master";--> statement-breakpoint
ALTER TABLE "daily_metrics" RENAME TO "overview_daily_summary";--> statement-breakpoint
ALTER TABLE "metric_observations" RENAME TO "usage_daily_records";--> statement-breakpoint
ALTER TABLE "rating_snapshots" RENAME TO "rating_daily_records";--> statement-breakpoint
ALTER TABLE "reviews" RENAME TO "review_records";--> statement-breakpoint
ALTER TABLE "releases" RENAME TO "release_summary";--> statement-breakpoint
ALTER TABLE "app_version_metrics" RENAME TO "app_version_daily_records";--> statement-breakpoint
ALTER TABLE "os_version_metrics" RENAME TO "os_version_daily_records";--> statement-breakpoint
ALTER TABLE "device_metrics" RENAME TO "device_daily_records";--> statement-breakpoint

ALTER TABLE "app_master" RENAME CONSTRAINT "apps_pkey" TO "app_master_pkey";--> statement-breakpoint
ALTER TABLE "overview_daily_summary" RENAME CONSTRAINT "daily_metrics_pkey" TO "overview_daily_summary_pkey";--> statement-breakpoint
ALTER TABLE "usage_daily_records" RENAME CONSTRAINT "metric_observations_pkey" TO "usage_daily_records_pkey";--> statement-breakpoint
ALTER TABLE "rating_daily_records" RENAME CONSTRAINT "rating_snapshots_pkey" TO "rating_daily_records_pkey";--> statement-breakpoint
ALTER TABLE "review_records" RENAME CONSTRAINT "reviews_pkey" TO "review_records_pkey";--> statement-breakpoint
ALTER TABLE "release_summary" RENAME CONSTRAINT "releases_pkey" TO "release_summary_pkey";--> statement-breakpoint
ALTER TABLE "app_version_daily_records" RENAME CONSTRAINT "app_version_metrics_pkey" TO "app_version_daily_records_pkey";--> statement-breakpoint
ALTER TABLE "os_version_daily_records" RENAME CONSTRAINT "os_version_metrics_pkey" TO "os_version_daily_records_pkey";--> statement-breakpoint
ALTER TABLE "device_daily_records" RENAME CONSTRAINT "device_metrics_pkey" TO "device_daily_records_pkey";--> statement-breakpoint
ALTER TABLE "overview_daily_summary" RENAME CONSTRAINT "daily_metrics_app_id_apps_id_fk" TO "overview_daily_summary_app_id_app_master_id_fk";--> statement-breakpoint
ALTER TABLE "usage_daily_records" RENAME CONSTRAINT "metric_observations_app_id_apps_id_fk" TO "usage_daily_records_app_id_app_master_id_fk";--> statement-breakpoint
ALTER TABLE "rating_daily_records" RENAME CONSTRAINT "rating_snapshots_app_id_apps_id_fk" TO "rating_daily_records_app_id_app_master_id_fk";--> statement-breakpoint
ALTER TABLE "review_records" RENAME CONSTRAINT "reviews_app_id_apps_id_fk" TO "review_records_app_id_app_master_id_fk";--> statement-breakpoint
ALTER TABLE "release_summary" RENAME CONSTRAINT "releases_app_id_apps_id_fk" TO "release_summary_app_id_app_master_id_fk";--> statement-breakpoint
ALTER TABLE "sync_runs" RENAME CONSTRAINT "sync_runs_app_id_apps_id_fk" TO "sync_runs_app_id_app_master_id_fk";--> statement-breakpoint
ALTER TABLE "app_version_daily_records" RENAME CONSTRAINT "app_version_metrics_app_id_apps_id_fk" TO "app_version_daily_records_app_id_app_master_id_fk";--> statement-breakpoint
ALTER TABLE "os_version_daily_records" RENAME CONSTRAINT "os_version_metrics_app_id_apps_id_fk" TO "os_version_daily_records_app_id_app_master_id_fk";--> statement-breakpoint
ALTER TABLE "device_daily_records" RENAME CONSTRAINT "device_metrics_app_id_apps_id_fk" TO "device_daily_records_app_id_app_master_id_fk";--> statement-breakpoint

ALTER INDEX "apps_code_uidx" RENAME TO "app_master_code_uidx";--> statement-breakpoint
ALTER INDEX "daily_metrics_app_platform_date_uidx" RENAME TO "overview_daily_summary_app_platform_date_uidx";--> statement-breakpoint
ALTER INDEX "daily_metrics_app_date_idx" RENAME TO "overview_daily_summary_app_date_idx";--> statement-breakpoint
ALTER INDEX "daily_metrics_app_platform_date_idx" RENAME TO "overview_daily_summary_app_platform_date_idx";--> statement-breakpoint
ALTER INDEX "metric_observations_identity_uidx" RENAME TO "usage_daily_records_identity_uidx";--> statement-breakpoint
ALTER INDEX "metric_observations_app_date_idx" RENAME TO "usage_daily_records_app_date_idx";--> statement-breakpoint
ALTER INDEX "rating_snapshots_identity_uidx" RENAME TO "rating_daily_records_identity_uidx";--> statement-breakpoint
ALTER INDEX "rating_snapshots_app_date_idx" RENAME TO "rating_daily_records_app_date_idx";--> statement-breakpoint
ALTER INDEX "reviews_app_platform_external_uidx" RENAME TO "review_records_app_platform_external_uidx";--> statement-breakpoint
ALTER INDEX "reviews_app_reviewed_at_idx" RENAME TO "review_records_app_reviewed_at_idx";--> statement-breakpoint
ALTER INDEX "releases_app_platform_version_uidx" RENAME TO "release_summary_app_platform_version_uidx";--> statement-breakpoint
ALTER INDEX "releases_app_released_at_idx" RENAME TO "release_summary_app_released_at_idx";--> statement-breakpoint
ALTER INDEX "app_version_metrics_identity_uidx" RENAME TO "app_version_daily_records_identity_uidx";--> statement-breakpoint
ALTER INDEX "app_version_metrics_app_date_idx" RENAME TO "app_version_daily_records_app_date_idx";--> statement-breakpoint
ALTER INDEX "os_version_metrics_identity_uidx" RENAME TO "os_version_daily_records_identity_uidx";--> statement-breakpoint
ALTER INDEX "os_version_metrics_app_date_idx" RENAME TO "os_version_daily_records_app_date_idx";--> statement-breakpoint
ALTER INDEX "device_metrics_identity_uidx" RENAME TO "device_daily_records_identity_uidx";--> statement-breakpoint
ALTER INDEX "device_metrics_app_date_idx" RENAME TO "device_daily_records_app_date_idx";--> statement-breakpoint

DROP TABLE "release_observations";--> statement-breakpoint
DROP TABLE "regional_metrics";
