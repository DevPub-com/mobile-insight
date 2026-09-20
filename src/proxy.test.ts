import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { config, proxy } from "./proxy";

afterEach(() => vi.unstubAllEnvs());

describe("public dashboard access before account registration", () => {
  it.each([
    ["production", "", ""],
    ["production", "viewer", ""],
    ["production", "viewer", "configured-password"],
    ["development", "", ""],
  ])("allows access in %s regardless of legacy Basic Auth settings", (environment, username, password) => {
    vi.stubEnv("NODE_ENV", environment);
    vi.stubEnv("DASHBOARD_BASIC_USER", username);
    vi.stubEnv("DASHBOARD_BASIC_PASSWORD", password);
    vi.stubEnv("TRUST_REVERSE_PROXY", "");
    const response = proxy();
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.has("www-authenticate")).toBe(false);
  });

  it.each(["/dashboard/kis", "/api/apps", "/api/dashboard/kis/summary", "/api/ai/briefing"])("matches the public dashboard route %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(true);
  });

  it("leaves batch synchronization to its existing bearer authentication", () => {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: "/api/sync" })).toBe(false);
  });
});
