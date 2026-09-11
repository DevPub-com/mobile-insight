import { describe, expect, it } from "vitest";
import { parseGoogleDeviceInstalls } from "../google-device-installs";
import { buildModelDownloads } from "@/services/mobile/tabs/download-breakdown.service";

describe("model installs", () => {
  it("keeps device downloads separate from device installs and ignores unknown counts", () => {
    const observations = parseGoogleDeviceInstalls("app", [
      { Date: "2026-09-01", Device: "Galaxy", "Daily Device Installs": "10", "Daily User Installs": "8" },
      { Date: "2026-09-02", Device: "Galaxy", "Daily Device Installs": "5", "Daily User Installs": "4" },
      { Date: "2026-09-02", Device: "Pixel", "Daily Device Installs": "0", "Daily User Installs": "0" },
      { Date: "2026-09-02", Device: "Unknown", "Daily Device Installs": "" },
      { Date: "2026-08-01", Device: "Old", "Daily Device Installs": "100" },
    ], "2026-09-03T00:00:00Z");
    const rows = buildModelDownloads(observations, { startDate: "2026-09-01", endDate: "2026-09-02" }, "app");
    expect(rows).toEqual([
      { model: "Galaxy", platform: "android", downloads: 12, installs: 15, days: 2 },
      { model: "Pixel", platform: "android", downloads: 0, installs: 0, days: 1 },
    ]);
  });
  it("does not merge other apps or infer installs from downloads", () => {
    const observations = parseGoogleDeviceInstalls("other", [{ Date: "2026-09-01", Device: "A", "Daily Device Installs": "30" }], "now");
    observations.push(...parseGoogleDeviceInstalls("app", [{ Date: "2026-09-01", Device: "A", "Daily User Installs": "3" }], "now"));
    expect(buildModelDownloads(observations, { startDate: "2026-09-01", endDate: "2026-09-01" }, "app")).toEqual([
      { model: "A", platform: "android", downloads: 3, installs: null, days: 1 },
    ]);
  });
});
