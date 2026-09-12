# Review column removal

User explicitly confirmed removing all five columns from `public.review_records`: `territory`, `source`, `quality`, `observed_at`, `description`.

- Removed columns from Drizzle review schema, repository mapping, sync insert mapping and conflict updates; adapted reclassification script.
- Added idempotent migration `0017_remove_review_metadata.sql` and registered it in the migration journal. Executed only the scoped five-column ALTER TABLE against the connected database, without CASCADE.
- Before and after: 1,780 review rows and 1,778 non-null topic-path records. Verification query returned no remaining targeted columns.
- Targeted storage/schema/repository/sync tests: 36 passed. TypeScript and production build passed. `git diff --check` passed.
- The deleted column values are no longer retained in the live table. No new backup was created; restoring those values would require an existing database backup or a separate source reimport. Backup availability was not verified.
