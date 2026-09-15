# Scheduled synchronization runner

The scheduled workflow now executes `scripts/sync.ts` on GitHub Actions instead of holding a Vercel HTTP request open. The observed HTTP 504 failures occurred after approximately 300 seconds, while iOS was still running. A runner job has a 60-minute limit and workflow runs are serialized.

## Required deployment setup

Before enabling the changed workflow on the default branch, configure the following repository Actions secrets using the existing production values. Values must not be committed or printed:

- `DATABASE_URL` (the production Supabase connection)
- `GOOGLE_KIS_SERVICE_ACCOUNT_JSON`
- `GOOGLE_KIS_BUCKET_NAME`
- `APPLE_KIS_ISSUER_ID`
- `APPLE_KIS_KEY_ID`
- `APPLE_KIS_PRIVATE_KEY`
- `APPLE_KIS_VENDOR_NUMBER`
- `GA4_KIS_PROPERTY_ID`
- `GEMINI_API_KEY` for AI classification

The existing application URL and synchronization token do not supply these credentials to the runner. This change therefore requires secret configuration as well as pushing the workflow. No production credentials have been copied by this change.

## Verification after setup

1. Dispatch `Scheduled Data Synchronization` with `sync_type=all`.
2. Check each platform result, not only the workflow start. The CLI exits nonzero for both `partial` and `failed`.
3. Verify finished timestamps and latest observation dates in the database. A successful fetch with no new source rows does not prove data freshness.
4. Confirm the next scheduled `voc` run also completes.

The scheduled times remain 15:30 KST for all data and every three hours for VoC (actual dispatch may be delayed). Historical `running` records from terminated HTTP requests are not modified automatically. The authenticated HTTP sync route remains available, but is no longer used by the schedule; it now returns a non-2xx response for incomplete synchronization.

## Local verification against production data (2026-09-15 KST)

- VoC: Android 71 records / iOS 1,766 records, both successful; iOS completed in 62 seconds.
- Full batch: analytics 11,673 / Android 58,837 / iOS 1,894 records, all successful. Android completed in 22 seconds and iOS in 64 seconds; the full run completed around 09:27:51 KST.
- Counts represent processed/upserted records, not necessarily new records.
- Apple version page size was reduced from 200 to 20 after a 93-second retry exhaustion during the first verification run.
- 41 related tests, TypeScript checking, and targeted ESLint passed.
- The new GitHub workflow has not been pushed or executed remotely. Repository secret configuration and a remote full-batch run remain required.
