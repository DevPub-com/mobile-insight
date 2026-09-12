# Review topic hierarchy

Reviews preserve up to two `{ major, middle, minor }` paths in `review_records.ai_topic_paths`, with `ai_taxonomy_version = 2` for validated model results. `ai_topics` remains a compatibility field. No content keyword dictionaries or word-to-category prompt examples are used.

The model selects a supported major category and concise semantic middle/minor labels. Unknown classification uses `기타` with null child levels; ordinary feedback can have a general minor topic. Failed model results remain eligible for retry.

Review cards show separate `#대분류 #중분류 #소분류` chips. Minor-topic charts and notable reviews use the full path plus sentiment as identity, preventing collisions between same-named children. Each review counts once per path. Notable reviews require two matching reviews in the selected period; unclassified and legacy flat topics do not invent a minor category.

Apply migration 0016 before deploying code. Reclassify existing reviews using `npx tsx scripts/reclassify-review-topics.ts --apply --limit=100`. Without `--apply`, the script only reports pending selection size. Successful version-2 rows are skipped on subsequent runs, and failed rows remain retryable. The script only updates classification fields and checks that review content has not changed since it was read.
