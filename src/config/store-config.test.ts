import { describe, expect, it } from "vitest";

import { getStoreCredentialProfile } from "./store-config";

describe("store credential profiles", () => {
  it("configures KIS GA4 with its existing property and service account variables", () => {
    expect(getStoreCredentialProfile("kis")?.googleAnalytics).toEqual({
      propertyIdEnv: "GA4_KIS_PROPERTY_ID",
      serviceAccountJsonEnv: "GOOGLE_KIS_SERVICE_ACCOUNT_JSON",
    });
  });
});
