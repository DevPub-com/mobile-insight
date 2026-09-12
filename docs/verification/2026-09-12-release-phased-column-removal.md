# Release phased deployment column removal

- User requested removal of `release_summary.rollout_fraction`, `phased_release_state`, and `phased_release_day` because phased deployment is unused.
- Removed the columns from the application schema, release types, normalization, persistence and repository mappings. Removed Apple's phased release relationship request and its unused response fields.
- Added idempotent migration `0023_remove_release_phased_metadata.sql` and journal entry.
- Applied the exact three-column DROP to the configured database in a transaction. Before deletion: 160 release rows; all three columns had zero non-null values. After deletion: 160 rows; information_schema returned no matching columns. Transaction completed successfully.
- No non-null values were removed; no column backup was created. Reintroducing the feature would require restoring schema and collection code.
- Verification: 45 tests passed across schema, upsert, Apple release and Google release suites. `git diff --check` passed.
- Full TypeScript checking failed in the unrelated `src/components/dashboard/download-chart.test.ts`: missing `buildFirstOpenSeries` export at line 131 and implicit-any bindings at line 135. No phased-release errors were reported. No claim of a passing overall typecheck or build is made.
