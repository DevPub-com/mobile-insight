import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

describe("GET /api/apps/icon", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("proxies and caches the official App Store artwork", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          results: [
            {
              artworkUrl100:
                "https://is1-ssl.mzstatic.com/image/thumb/app/100x100bb.jpg",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3]), {
          headers: { "content-type": "image/jpeg" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("https://example.test/api/apps/icon?iosAppId=1621986905"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toContain("max-age=86400");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid App Store ids without making an external request", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("https://example.test/api/apps/icon?iosAppId=not-an-id"),
    );

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
