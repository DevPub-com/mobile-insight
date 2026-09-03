# Review Metadata Design

## Goal

Populate iOS review versions from App Store version-specific review relationships and show a clear fallback when historical Google review exports do not provide an author name.

## Design

The App Store adapter will fetch the paginated `appStoreVersions` collection once per sync and share that result between release normalization and review collection. For every iOS version, it will page through `/v1/appStoreVersions/{id}/customerReviews`; the enclosing version's `versionString` becomes the review version. Reviews remain keyed by Apple's review ID, so the existing upsert updates previously stored `NULL` versions without duplicates.

Google monthly review exports have no reviewer-name column. Their stored author remains `NULL`, while the dashboard converts a missing author to `이름 미제공`. Recent Android reviews collected through the Reviews API keep and display `authorName` when Google supplies it.

## Error handling and tests

Version and review pagination failures remain isolated as the iOS reviews sync-type failure. Pure normalization tests prove that an Apple version is attached to its reviews and that missing authors receive the UI fallback. Existing database upsert tests already verify that matching reviews are updated rather than duplicated.
