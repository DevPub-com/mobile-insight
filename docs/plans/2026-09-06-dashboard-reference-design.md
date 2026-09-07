# Mobile Insight dashboard reference design

## Goal

Use the supplied 2026 Mobile Insight mockup as the final visual reference. The dashboard should answer two questions at a glance: what is the app's current state, and what changed after the latest release?

## Structure

- Keep the existing sidebar, application selector, typography, spacing system, and color roles.
- Use one global period control in the page header. All dashboard KPIs and trend charts consume the same period.
- Render four top-level KPI cards: downloads, rating, negative review rate, and new crash issues for the latest version.
- Split platform metrics 50:50 inside a single card, with Android in green and iOS in violet.
- Keep exactly two dashboard charts: download trend and rating trend.
- Replace the three-column dashboard footer with a two-column layout: negative review Top 10 and latest release impact.

## Data behavior

- Existing download, rating, review, and release services remain the source of truth.
- A negative review is a collected one- or two-star review.
- New crash issues must not be inferred from crash event totals. The UI displays unavailable state when issue-level data is absent.
- The latest release summary calculates rating and negative review changes independently for Android and iOS. Crash issue changes use issue-level summary data when supplied.

## Interaction and responsive behavior

- The global period control changes every KPI and both trend charts.
- “전체보기” opens the review view with the negative rating filter selected.
- “상세보기” opens the release impact view.
- Review copy is one-line truncated and exposes the full text through the native title tooltip.
- Desktop follows the dense reference layout; narrower widths collapse KPI, chart, and bottom grids without duplicating controls.

## Verification

- Add a source contract test for the four-card/two-chart/two-panel information architecture.
- Run the focused dashboard tests, typecheck, lint, and production build.
- Render the dashboard in the local browser and compare its hierarchy and spacing against the supplied image.
