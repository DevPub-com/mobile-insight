# Mobile Insight Data Quality and Backfill Design

## Goal

Store every externally sourced metric with explicit provenance, backfill every discoverable Android report, use Apple Analytics snapshots for downloads, collect complete Apple customer-review pagination, and make missing or non-exact data visible without fabricating zeroes.

## Architecture

Keep `daily_metrics` as the backward-compatible read model used by the dashboard. Add append/upsert observation tables for provenance and snapshots. `metric_observations` records one metric value, source, quality, observation time, and description for a specific app/platform/date/metric. `rating_snapshots` provides territory-aware overview-rating history. `release_observations` records store lifecycle observations without claiming that first observation equals an exact publish timestamp.

Store adapters return normalized values plus observation metadata. The persistence layer writes the existing read model and provenance in the same backfill batch. Existing data remains readable during migration.

## Google Play

List all bucket objects by prefix. Backfill all matching install, rating, and review month files. Install reports aggregate device and user install/uninstall fields without conflating them. Rating reports use `Total Average Rating` for the overview trend and retain `Daily Average Rating` as a separate observation. Country-dimension rows are accepted only when an unambiguous aggregate can be selected; contradictory values are unavailable rather than averaged.

Review CSV rows use the Play review ID when present and a stable content/date/version hash otherwise. The Reviews API remains incremental because Google limits it to recently created or modified reviews.

## App Store

Use Analytics Reports `ONE_TIME_SNAPSHOT` for historical App Store Downloads, then `ONGOING` for daily sync. Keep first-time downloads, redownloads, updates, and total downloads as separate observation metrics. Continue writing the selected dashboard download definition to `daily_metrics`.

Collect reviews from `/v1/apps/{id}/customerReviews` until `links.next` is absent. Save territory with review provenance/model support. The public lookup overview becomes a derived, territory-scoped daily snapshot; missing history remains unavailable.

## UI

Dashboard data includes metric-quality summaries. KPI cards show a compact info marker for estimated or derived data. Exact is available in the tooltip, while unavailable renders `—`, `미수집`, or `과거 데이터 없음`; null is never coerced to zero.

## Error Handling

Backfill persists completed batches before a later source fails. A sync type is not considered healthy solely because no exception occurred: zero records and stale observations remain visible through provenance and sync diagnostics.

## Testing

Unit tests cover object selection, install/rating parsing, stable review identity, Apple report pagination/parsing, observation upserts, and UI null/quality rendering. Schema tests verify additive tables and constraints. Full tests, typecheck, lint, and production build are required before completion.
