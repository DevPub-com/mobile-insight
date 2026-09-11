import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncAllApps } from "@/services/sync/sync-app";
import { POST } from "./route";

vi.mock("@/services/sync/sync-app", () => ({ syncAllApps: vi.fn() }));

const context = { params: Promise.resolve({ appId: "selected-app-id" }) };
const request = (origin = "https://example.test") => new Request(
  "https://example.test/api/dashboard/selected-app-id/sync",
  { method: "POST", headers: { origin } },
);

describe("dashboard manual sync", () => {
  beforeEach(() => vi.resetAllMocks());

  it("syncs only the selected app and preserves partial failure status", async () => {
    const data = [{ app: "kis", platform: "android", status: "partial", recordsCount: 12 }];
    vi.mocked(syncAllApps).mockResolvedValue(data);
    const response = await POST(request(), context);
    expect(syncAllApps).toHaveBeenCalledWith("all", "selected-app-id");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data });
  });

  it("rejects cross-origin requests before starting sync", async () => {
    expect((await POST(request("https://other.test"), context)).status).toBe(403);
    expect(syncAllApps).not.toHaveBeenCalled();
  });

  it("reports an unavailable app", async () => {
    vi.mocked(syncAllApps).mockResolvedValue([]);
    expect((await POST(request(), context)).status).toBe(404);
  });

  it("does not expose internal errors", async () => {
    vi.mocked(syncAllApps).mockRejectedValue(new Error("private connection details"));
    const response = await POST(request(), context);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private connection details");
  });
});
