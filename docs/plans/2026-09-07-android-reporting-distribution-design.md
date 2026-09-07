# Android reporting and distribution integration

## Scope

- Collect Google Play user-perceived crash and ANR 28-day weighted rates.
- Enable the existing GA4 active-user pipeline for KIS.
- Collect the current production country availability and production form-factor tracks.
- Surface MAU, stability rates, and Android distribution metadata in the dashboard.

## Design

Crash and ANR rates are stored as percentage points in `usage_daily_records` using
the existing `google_play_api` source. They are not written to the integer
`crashes` and `anrs` columns. A dedicated Reporting API JWT uses only the
`playdeveloperreporting` scope.

Android distribution is current app/track state rather than immutable release
history, so it is stored in `android_distribution_snapshots`, keyed by app and
platform. Country availability comes from the production track. Device types are
derived from active production track names (`production`, `wear:production`,
`tv:production`, and other documented form-factor prefixes); this is not a Play
Device Catalog compatibility claim.

KIS reuses the existing GA4 adapter by adding its already-defined environment
variable names to the credential profile. Production still requires the KIS GA4
property variable and external Google permissions.

The verified KIS GA4 property is `552787976`. The previous local value
`311475678` returned a Data API permission error because it selected the wrong
property; using the linked property succeeded without an additional GA4 access
grant. The local `.env` was corrected, while deployment environment variables
remain an operator-owned setting.

## Error handling

Stability and distribution have independent sync types. A denied Reporting API
request marks stability sync as failed without discarding successful installs,
ratings, reviews, or releases. Missing observations render as unavailable, never
as zero.

## Verification

- Enabled Google Play Developer Reporting API in Google Cloud project
  `mts-renewal` (`397732556725`).
- Final live sync on 2026-09-07: KIS GA4 6 records; KIS Android 348 records and
  `success`; stability 180 records (90 crash + 90 ANR); distribution 1 record.
- The current KIS distribution snapshot reports phone/tablet production, with
  `rest_of_world=true`.
- Pure normalization and request-contract tests for Play vitals.
- Release fetch tests cover country availability, optional-failure isolation,
  form-factor tracks, and edit cleanup.
- Dashboard summary tests cover current rate, previous-period point change,
  basis date, and sparse quality.
- Final verification: 36 test files / 196 tests passed; TypeScript and ESLint
  passed; the Next.js production build completed successfully.
- Independent code review found no remaining Critical or Important blocker in
  the integration scope after failure-isolation and observability fixes.
