# Mobile Insight Implementation Plan

> **For Codex:** Implement this plan task-by-task with test-first domain work and fresh verification before completion.

**Goal:** Build a standalone, multi-app-ready dashboard for Korean Investment app downloads, ratings, reviews, releases, and seven-day release impact.

**Architecture:** A single Next.js App Router application reads normalized PostgreSQL data through Drizzle repositories and Route Handlers. Store adapters run only on the server and upsert normalized records; the dashboard never calls Google or Apple directly.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Radix/shadcn-style primitives, Recharts, PostgreSQL, Drizzle ORM, Vitest.

---

### Task 1: Bootstrap and domain contracts

**Files:** `package.json`, configuration files, `src/domain/**/*.test.ts`, `src/domain/**/*.ts`

1. Install pinned runtime and development dependencies.
2. Write failing tests for combined downloads, negative-review rate, and release-impact windows.
3. Run Vitest and confirm failures are caused by missing domain functions.
4. Implement the smallest pure functions and rerun the tests.

### Task 2: Persistence and seed data

**Files:** `src/db/schema.ts`, `src/db/index.ts`, `src/db/repositories/*`, `drizzle.config.ts`, `drizzle/*`, `scripts/seed.ts`

1. Define five tables with composite uniqueness and query indexes.
2. Add repository reads and conflict-update writes.
3. Generate the initial SQL migration.
4. Add deterministic 90-day 한국투자 seed data with four releases and at least 30 reviews.

### Task 3: Store synchronization boundary

**Files:** `src/services/stores/*`, `src/services/sync/*`, `src/config/store-config.ts`, `src/app/api/sync/route.ts`

1. Define normalized store payloads and a mockable adapter interface.
2. Implement credential/config resolution without storing secrets in the database.
3. Record independent sync-run outcomes and protect the endpoint with `SYNC_SECRET`.
4. Keep unconfigured live adapters explicit: they report a safe configuration error rather than fabricating data.

### Task 4: Query APIs and dashboard

**Files:** `src/app/api/**/*`, `src/app/dashboard/[appId]/page.tsx`, `src/components/**/*`, `src/app/globals.css`

1. Implement app, overview, downloads, reviews, releases, release-impact, and sync-status APIs.
2. Build a desktop-first one-page dashboard with URL-persistent app selection.
3. Add period/platform/rating filters, release markers, pagination, partial-data states, and responsive basics.
4. Use seed fallback only when `DATABASE_URL` is absent so the UI can be reviewed without credentials.

### Task 5: Operations, documentation, and verification

**Files:** `README.md`, `.env.example`

1. Document local PostgreSQL, migration, seed, credentials, cron, app onboarding, and troubleshooting.
2. Run tests, typecheck, lint, and production build.
3. Review the implementation against the requirements and correct important findings.
