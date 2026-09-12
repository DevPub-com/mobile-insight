# Review AI column removal

- Explicitly requested removal of `public.review_records.ai_summary` and `ai_taxonomy_version` executed without CASCADE. Post-delete information_schema query returned no matching columns.
- Before/after preserved 1,780 reviews and 1,778 non-null topic paths. Deleted values comprised 1,713 summaries and 1,778 stored taxonomy versions. No new backup created; recovery requires an existing backup or regeneration.
- Removed storage schema, public review DTO fields, repository and sync/upsert mappings. Reclassification pending selection now uses absent/empty `ai_topic_paths` instead of stored version. The analysis result's in-memory validation version remains internal and is not stored.
- Related schema/upsert/repository/sync tests: 36 passed. `git diff --check` passed.
- Production compilation succeeded; overall build was blocked by concurrent unrelated GA4 first-open test type errors (`normalizeGa4FirstOpenReport`, `buildFirstOpenTrend`, `fetchFirstOpens`, `firstOpens`). Those files were not changed for this task.
