# Release status and track removal

- Removed `public.release_summary.status` and `track` following explicit user request, using scoped ALTER TABLE without CASCADE. Post-delete catalog query returned neither column.
- Preserved 163 releases and their dates. Before deletion: Android 5 production records, iOS 158 production records; all 163 had status values.
- Removed persisted fields from schema, upsert, dashboard repository, sync/backfill mappings, diagnostic SQL and release detail UI. Production-only Android selection now happens before insertion. Removed the obsolete post-insert deletion query that depended on stored track.
- Registered migration 0022. Reconciled a concurrently added duplicate journal index/timestamp by assigning the existing rating metadata migration the next journal index (21); preserved its SQL and tag.
- Relevant schema/upsert/Google release tests: 39 passed. Production build and TypeScript passed after retaining the badge import still used by representative reviews. Whitespace check passed.
- No new backup created. Deleted status/track values require an existing backup or source reimport for recovery.
