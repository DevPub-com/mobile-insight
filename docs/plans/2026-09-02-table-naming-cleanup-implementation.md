# Table Naming Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace ambiguous database table names with one Korean-friendly naming rule, retain future app-version/OS/device analysis data, and remove only unused regional and release-observation data.

**Architecture:** Keep one master table, one overall daily read model, normalized record tables for usage/rating/reviews/app-version/OS/device, one release summary table, and sync execution records. Rename existing tables in place so retained data survives; drop only regional breakdown data and release observation history.

**Tech Stack:** PostgreSQL, Drizzle ORM, TypeScript, Vitest, Next.js

---

### Task 1: Lock the naming policy with failing schema tests

**Files:**
- Modify: `src/db/schema.test.ts`

**Steps:**
1. Add assertions for `app_master`, `overview_daily_summary`, `usage_daily_records`, `rating_daily_records`, `review_records`, `release_summary`, and `sync_runs`.
2. Add assertions that release history and regional breakdown exports are absent, while app-version/OS/device daily records remain.
3. Run `npm test -- src/db/schema.test.ts` and confirm the assertions fail on the old names.

### Task 2: Rename retained tables and remove unused tables

**Files:**
- Modify: `src/db/schema.ts`
- Create: `drizzle/0012_plain_table_names.sql`
- Modify: `drizzle/meta/_journal.json`

**Steps:**
1. Rename retained Drizzle table symbols and physical names.
2. Remove `release_observations` and `regional_metrics`; rename the other three GA4 breakdown tables to `app_version_daily_records`, `os_version_daily_records`, and `device_daily_records`.
3. Add a data-preserving SQL migration using `ALTER TABLE ... RENAME TO` for retained tables and `DROP TABLE` for rejected tables.
4. Rename retained indexes and constraints so later schema generation does not recreate them.
5. Run the schema test and confirm it passes.

### Task 3: Remove dead collection and persistence paths

**Files:**
- Modify: `src/services/google/adapter/ga4.adapter.ts`
- Modify: `src/services/sync/sync-app.ts`
- Modify: `src/services/sync/backfill-app.ts`
- Modify: `src/services/mobile/store-adapter.ts`
- Modify: `src/db/upsert.ts`
- Modify: `src/db/dashboard.repository.ts`
- Modify: `src/domain/types.ts`
- Delete: `src/services/mobile/release-observations.ts`
- Modify associated tests.

**Steps:**
1. Change tests to expect only daily GA4 metrics and retained record types.
2. Run focused tests and confirm failures come from the old collection paths.
3. Preserve app-version/OS/device extension points and remove only regional report persistence/query code.
4. Remove release observation generation, persistence, query, and domain fields.
5. Rename retained TypeScript schema imports and references.
6. Run focused tests until green.

### Task 4: Update operational SQL and documentation

**Files:**
- Modify: `scripts/diagnose-sync.ts`
- Modify: `README.md`
- Modify relevant current design documents where they describe the live schema.

**Steps:**
1. Replace old physical table names in executable SQL.
2. Document the fixed suffix meanings: `_master`, `_summary`, `_records`, `_runs`.
3. Record the removal decision and its reason.

### Task 5: Verify the whole application

**Steps:**
1. Run `npm test`.
2. Run `npm run typecheck`.
3. Run `npm run lint`.
4. Run `npm run build`.
5. Inspect the final diff for stale old table names and unintended edits.
