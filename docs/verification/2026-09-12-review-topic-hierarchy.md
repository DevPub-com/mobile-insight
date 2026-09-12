# Review hierarchy verification

- Full Vitest run: 62 files, 307 tests passed.
- After final sentiment-chip placement and topic-only backfill restriction: affected UI/domain tests 37 passed; production build passed again.
- Next.js production build: exit 0, TypeScript passed.
- ESLint: no errors; existing unused `isProduction` warning in `src/proxy.ts`.
- `git diff --check`: passed.
- Connected database: nullable `ai_topic_paths` and `ai_taxonomy_version` columns added successfully in one transaction. Only these two additions were executed; migration journal file registers idempotent migration 0016 for future deployments.
- Initial reclassification attempt was blocked by approval review. After the user explicitly requested reanalysis of existing DB reviews, reclassification was executed using `scripts/reclassify-review-topics.ts --apply --limit=5000`.
- Live run: 1,778 selected; 1,760 updated on first pass; remaining 18 updated on retry. Independent database count after completion: total 1,778, version-2 paths present 1,778, pending 0, with at least one minor topic 1,725. The remaining 53 have no minor topic and are excluded from minor-topic notable-review aggregation. Only topic fields and update timestamps were changed; existing sentiment and summary fields were preserved.
- Existing flat tags cannot reliably recover a minor topic. They display the general fallback chip and remain outside minor-topic notable-review aggregation until reclassified.
