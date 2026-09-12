# Rating metadata column removal

- Removed public.rating_daily_records columns territory, source, quality, observed_at, description at the user’s request.
- Preflight: 262 rows, no duplicate app_id/platform/date keys. Post-migration: 262 rows; all five columns absent.
- Unique index and upsert now use app_id/platform/date. Existing rating values and counts retained.
- Updated repository and sync mappings. Optional transport metadata can still be supplied by collectors, but is not persisted. Missing snapshot quality is treated as derived rather than exact. iOS snapshot sorting supports missing observation timestamps.
- Migration 0020 applied directly in a transaction; registered in the local journal for future migration runs. The SQL is repeatable; the remote Drizzle migration ledger was not modified.
- Validation: 60 tests passed across schema, upsert, repository, overview and backfill; TypeScript and git diff --check passed.
