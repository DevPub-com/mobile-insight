# Store History Backfill Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use test-driven development to implement this plan task-by-task.

**Goal:** Add a resumable `npm run db:backfill` command that imports the maximum useful Apple download history and all available Google Play review exports without slowing the regular sync endpoint.

**Architecture:** Keep `/api/sync` focused on current data. Add pure parsing/date helpers with unit tests, expose explicit backfill methods on the store adapters, and orchestrate them from a local script that loads `.env.local`, reads active apps, and upserts records by the existing unique keys. Apple daily report requests run sequentially across the one-year retention window and skip unavailable-report responses; Google history comes from every matching installs, ratings, and monthly review CSV in the existing Play reporting bucket, while regular sync reads only the newest statistics file plus the Reviews API.

**Tech Stack:** TypeScript, Vitest, App Store Connect Sales Reports API, Google Cloud Storage, Drizzle ORM, PostgreSQL.

---

### Task 1: Apple report date planning and unavailable responses

**Files:**
- Modify: `src/services/stores/apple-sales.ts`
- Modify: `src/services/stores/apple-sales.test.ts`
- Modify: `src/services/stores/app-store.adapter.ts`

1. Write failing tests for a UTC one-year daily range and Apple's unavailable-report response classification.
2. Run the focused test and verify it fails for missing exports.
3. Implement the minimal helpers and use them in a sequential Apple download backfill.
4. Run the focused test and verify it passes.

### Task 2: Google monthly review report parsing

**Files:**
- Create: `src/services/stores/google-reviews.ts`
- Create: `src/services/stores/google-reviews.test.ts`
- Modify: `src/services/stores/google-play.adapter.ts`

1. Write failing tests that map official Google review CSV columns and reject unusable rows.
2. Run the focused test and verify it fails for the missing module.
3. Implement the parser and a Google Cloud Storage backfill method for all matching monthly files.
4. Run the focused test and verify it passes.

### Task 3: Backfill orchestration command

**Files:**
- Create: `src/services/sync/backfill-app.ts`
- Create: `scripts/backfill.ts`
- Modify: `package.json`
- Modify: `README.md`

1. Add an orchestrator that processes active apps and each configured store independently.
2. Add `db:backfill`, environment loading, progress output, and nonzero exit behavior for real failures.
3. Document the distinction between one-time backfill and regular sync.

### Task 4: Verification

1. Run focused unit tests.
2. Run the full test suite, typecheck, lint, and production build.
3. Review the diff for credential exposure, accidental demo writes, and unbounded concurrency.
