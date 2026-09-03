# Google Historical Review Author Enrichment

Google monthly review CSV exports omit reviewer names. During `db:backfill`, extract the real review ID from each available Review Link and call Android Publisher `reviews.get` with a concurrency limit of five. Merge only API-provided author and version metadata into the CSV-normalized review, preserving CSV content and timestamps. Ignore 404 responses because reviews may no longer be individually available; propagate authentication, authorization, quota, and server errors so a misleadingly successful backfill is not reported.

The existing `(app_id, platform, external_id)` upsert key updates prior `NULL` authors without duplicating reviews. Regular `/api/sync` continues to use the paginated list endpoint for current reviews.
