UPDATE "release_summary"
SET "version" = btrim(substring(btrim("version") from '^[0-9]+[[:space:]]*\([[:space:]]*([^()]+)[[:space:]]*\)$')),
    "updated_at" = now()
WHERE "platform" = 'android'
  AND btrim("version") ~ '^[0-9]+[[:space:]]*\([[:space:]]*[^()]+[[:space:]]*\)$'
  AND btrim(substring(btrim("version") from '^[0-9]+[[:space:]]*\([[:space:]]*([^()]+)[[:space:]]*\)$')) <> '';
