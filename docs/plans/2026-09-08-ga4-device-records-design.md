# GA4 device daily records integration

## Scope

Populate `device_daily_records` with daily Android and iOS active-user counts
grouped by GA4 device brand and model.

## Data flow

The existing GA4 summary query remains unchanged so device groups cannot distort
1/7/28-day distinct-user metrics. A separate report requests `date`, `platform`,
`mobileDeviceBranding`, and `mobileDeviceModel` with `activeUsers`.

The device report is split into 31-day windows and paginated using deterministic
dimension ordering, `rowCount`, and `offset`. Transient 429/500/503 responses use
capped retries. Missing brand or model labels use the stable `(empty)` bucket,
which remains distinct from GA4's literal `(not set)` bucket. Unsupported platforms,
invalid dates, and invalid counts are discarded.

After all pages are fetched successfully, the requested app/platform/date range
is replaced transactionally in `device_daily_records`. This removes rows that
GA4 later retracts or changes while preserving data outside the refreshed range.
Normal sync refreshes 35 days; backfill refreshes 365 days.

GA4-relative dates (`NdaysAgo` through `yesterday`) follow the property calendar.
The concrete database replacement range is calculated using the property time
zone returned in response metadata. If GA4 reports high-cardinality data loss,
privacy thresholding, sampling, a changing row count, or a missing time zone, the
replacement is rejected and the previous complete range is retained.

## Failure handling

Summary and device reports are fetched independently. A device failure does not
discard MAU results, and either failure remains visible as an analytics error.
The regular sync returns a separate `analytics` result, so a GA4 failure
does not mark unrelated Google Play or App Store runs as partial and the CLI can
exit nonzero for that failure. Device active-user rows are distribution data and must not be summed as a
deduplicated app-wide MAU value.

## Verification

- Device report normalization tests for Android, iOS, unknown labels, and invalid rows.
- Pagination test covering multiple offsets.
- Incomplete-report rejection and transient retry tests.
- Database tests for idempotent upsert and transactional date-range replacement.
- Database rollback and replacement-scope validation tests.
- Sync isolation tests showing summary data survives a device-report failure.

### Operational verification (2026-09-08 KST)

After the guarded implementation was executed locally, `npm run data:sync`
completed and `npm run data:inspect-devices` returned:

| App | Platform | Rows | Date range | Distinct brand/model pairs |
| --- | --- | ---: | --- | ---: |
| KIS | Android | 3,548 | 2026-09-04 – 2026-09-07 | 1,181 |
| KIS | iOS | 318 | 2026-09-04 – 2026-09-07 | 80 |
| WTC | Android | 245 | 2026-08-03 – 2026-09-07 | 52 |
| WTC | iOS | 78 | 2026-08-03 – 2026-09-07 | 18 |

KIS currently returns only September 4–7 from its linked GA4 property; the
collector requested the full rolling range and does not fabricate missing days.
