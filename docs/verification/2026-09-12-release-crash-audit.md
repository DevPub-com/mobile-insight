# Release date and crash attribution audit

Verified 2026-09-12 against configured kis App Store Connect credentials and release_summary / metric_observations.

- iOS 2.27.05: App Store Connect READY_FOR_SALE, MANUAL release; earliestReleaseDate null; createdDate 2026-09-08T20:29:37-07:00 (2026-09-09T03:29:37Z). Database releasedAt equals this version creation timestamp, not a verified public release time.
- Android 2.27.05 build 26091008: database releasedAt 2026-09-10T03:20:35Z. Google collector uses first observation time; this is not a verified release time.
- Public iTunes lookup for the configured app in KR returned version 2.27.00 with currentVersionReleaseDate 2026-08-28T23:55:34Z. It disagrees with Connect's newer published status and cannot verify 2.27.05 release time in this lookup.
- Apple original App Crashes report includes App Version. Raw report aggregation for September 9–11:

| Date | All versions | 2.27.00 | Other versions |
|---|---:|---:|---:|
| 2026-09-09 | 130 | 119 | 11 |
| 2026-09-10 | 133 | 119 | 14 |
| 2026-09-11 | 75 | 66 | 9 |
| Total | 338 | 304 | 34 |

No 2.27.05 rows were present in the inspected September 9–11 report data. This is missing observed data, not proof of zero crashes.

Root cause: parseAppleCrashRows sums rows by date and discards App Version. Release impact consumes the platform total after release_summary.releasedAt. Therefore 338 is not attributable to version 2.27.05.

Read-only audit; release dates and crash data were not changed.
