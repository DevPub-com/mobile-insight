# Release date metadata removal

- User requested deletion of `public.release_summary.release_date_source` and `release_date_estimated`. Both columns were inspected and deleted in a scoped ALTER TABLE without CASCADE. Post-delete catalog query returned no matching columns.
- Before/after counts: 163 release records, 163 stored release dates. Before deletion all 163 records had source metadata and were marked estimated. Dates themselves were not changed.
- Removed DB schema, repository, sync/backfill persistence and diagnostic SQL references. Registered migration 0020.
- Upsert now preserves existing `released_at` for an existing app/platform/version; other release fields still update. Automatic correction of an existing release date based on source/estimated priority is no longer possible without those stored fields.
- UI labels stored dates as reference dates and explains the lack of date provenance; no row-level exact/estimated assertion is derived from absent metadata.
- Schema/upsert tests passed (28 tests); updated dashboard layout tests passed (27 tests). Production build, TypeScript and whitespace checks passed.
- No new backup created. Deleted metadata can only be recovered from an existing backup or source reimport; availability of backups was not checked.
