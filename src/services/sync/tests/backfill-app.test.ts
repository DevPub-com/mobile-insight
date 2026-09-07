import { describe, expect, it } from "vitest";

import type { StoreSyncPayload } from "@/services/mobile/common/store-adapter";
import {
  backfillPayloadRecordCount,
  mergeBackfillErrors,
} from "../backfill-app";

const payload = (overrides: Partial<StoreSyncPayload> = {}): StoreSyncPayload => ({
  metrics: [],
  reviews: [],
  releases: [],
  errors: [],
  ...overrides,
});

describe("Android backfill progress", () => {
  it("counts optional integration records", () => {
    expect(
      backfillPayloadRecordCount(
        payload({
          observations: [
            {} as NonNullable<StoreSyncPayload["observations"]>[number],
          ],
          ratingSnapshots: [
            {} as NonNullable<StoreSyncPayload["ratingSnapshots"]>[number],
          ],
          androidDistribution: {} as NonNullable<
            StoreSyncPayload["androidDistribution"]
          >,
        }),
      ),
    ).toBe(3);
  });

  it("keeps partial integration errors visible after later successful batches", () => {
    const errors = new Set<string>();
    mergeBackfillErrors(errors, payload({ errors: ["stability: denied"] }));
    mergeBackfillErrors(errors, payload({ metrics: [{} as never] }));

    expect([...errors]).toEqual(["stability: denied"]);
  });
});
