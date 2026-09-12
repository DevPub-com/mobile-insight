# Review version-code and language removal

- User-requested deletion of `public.review_records.app_version_code` and `reviewer_language` executed without CASCADE. Post-delete information_schema query found neither column.
- Before/after counts: 1,780 reviews, 1,778 non-null topic paths. Deleted values: 24 version codes and 29 reviewer languages. Display version column remains intact.
- Removed review schema, sync insert and upsert references. Android release version mappings now derive from Android release rows with numeric buildNumber and nonempty version; review-derived historic mappings are no longer available.
- Registered idempotent migration 0019. Relevant schema/upsert/repository/sync tests: 36 passed. Production build and TypeScript passed; diff whitespace check passed.
- No backup was created for deleted values. Recovery requires an existing backup or source reimport.
