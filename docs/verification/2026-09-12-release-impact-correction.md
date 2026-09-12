# Release impact correction

User-confirmed business release date for kis Android/iOS 2.27.05: 2026-09-12.

Both release_summary rows updated to 2026-09-12T00:00:00Z (date-based reporting anchor, not a claim of exact release time). Backup: /private/tmp/release-dates-before-correction-1789221446827.json. Existing upsert preserves stored releasedAt on conflict.

Live database verification via getDashboardData + buildDashboardSummary:
- Both after windows: September 12 through September 12.
- Both crashReports.value null and sparkline []. Aggregate platform crashes are excluded from version impact.
- Both downloads.after null and downloads sparkline [].
- Android rating 4.5, negative reviews 0%, 2 reviews; one daily point each.
- iOS collected store rating snapshot 2.94467, negative reviews null, 0 collected reviews. Rating is a store snapshot, not the rating exclusively from users of this version.

Apple crash ingestion now also retains per-version metrics as crash_report_count:version:<version>. Historical aggregate-only observations remain available to general crash history but cannot populate a version's release-impact card. Android has no version-specific crash observations yet and is shown as missing rather than substituting platform totals.

Mini charts use post-release daily values instead of before/after comparison endpoints. Missing values show no data; a single observed point displays as a dot without an invented line.

Verification: 38 tests passed across dashboard summary, Apple crash parser, crash history and database upsert. Typecheck passed. Layout source-string suite initially exposed two unrelated outdated KPI-copy assertions, plus an assertion updated for the new optional-chain sparkline implementation; full layout suite is not claimed passing.
