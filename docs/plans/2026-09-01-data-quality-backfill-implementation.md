# Data Quality and Backfill Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the P0 data-quality, historical backfill, snapshot, and UI provenance requirements without replacing missing values with fabricated zeroes.

**Architecture:** Preserve `daily_metrics` as the dashboard read model and add normalized observation/snapshot tables. Extend adapters to emit provenance alongside values, then expose quality summaries to the existing dashboard.

**Tech Stack:** Next.js 16, TypeScript, Drizzle/PostgreSQL, Vitest, Google Cloud Storage, App Store Connect API.

---

### Task 1: Provenance domain and schema

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/db/schema.ts`
- Modify: `src/db/schema.test.ts`
- Modify: `src/db/upsert.ts`
- Modify: `src/db/upsert.test.ts`
- Create: `drizzle/0007_data_quality_observations.sql`

1. Write failing schema and upsert tests for quality/source observations and rating/release snapshots.
2. Run focused tests and confirm failures describe missing tables/functions.
3. Add enums, tables, domain types, and conflict-safe upserts.
4. Run focused tests to green and refactor.

### Task 2: Google Play complete report backfill

**Files:**
- Modify: `src/services/google/google-installs.ts`
- Create: `src/services/google/google-ratings.ts`
- Modify: `src/services/google/google-reviews.ts`
- Modify: `src/services/google/google-play.adapter.ts`
- Modify/Create tests under `src/services/google/tests/`

1. Add failing tests for all install fields, total/daily rating parsing, stable review IDs, and complete report-name selection.
2. Confirm red tests.
3. Implement parsers and adapter observation output using all prefix-listed files during backfill.
4. Confirm focused and Google service tests pass.

### Task 3: Apple downloads and complete reviews

**Files:**
- Create: `src/services/apple/apple-downloads.ts`
- Modify: `src/services/apple/apple-analytics.ts`
- Modify: `src/services/apple/apple-reviews.ts`
- Modify: `src/services/apple/app-store.adapter.ts`
- Modify/Create tests under `src/services/apple/tests/`

1. Add failing tests for download-event normalization and app-level review pagination/territory.
2. Confirm red tests.
3. Implement generic analytics report retrieval for ONE_TIME_SNAPSHOT/ONGOING and app-level reviews pagination.
4. Confirm focused Apple tests pass.

### Task 4: Persist observations and snapshots

**Files:**
- Modify: `src/services/mobile/store-adapter.ts`
- Modify: `src/services/sync/backfill-app.ts`
- Modify: `src/services/sync/sync-app.ts`
- Add focused sync tests.

1. Add failing persistence-contract tests.
2. Confirm red tests.
3. Persist observations and daily rating/release snapshots with each payload.
4. Confirm sync tests pass.

### Task 5: UI quality and missing-state semantics

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/db/dashboard.repository.ts`
- Modify: `src/components/dashboard/dashboard-shell.tsx`
- Modify relevant component/service tests.

1. Add failing tests for unavailable negative-review rate and quality labels.
2. Confirm red tests.
3. Expose quality summaries and render `—`/tooltips without null-to-zero coercion.
4. Confirm dashboard tests pass.

### Task 6: Verification

1. Run `npm test`.
2. Run `npm run typecheck`.
3. Run `npm run lint`.
4. Run `npm run build`.
5. Review the diff against every P0 item and document remaining external prerequisites.
