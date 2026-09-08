import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { proxy } from "./proxy";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("dashboard proxy authentication", () => {
  it("allows access in production when authentication credentials are not set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DASHBOARD_BASIC_USER", "");
    vi.stubEnv("DASHBOARD_BASIC_PASSWORD", "");
    vi.stubEnv("TRUST_REVERSE_PROXY", "");

    expect(proxy(new NextRequest("https://example.test/dashboard/kis")).status).toBe(200);
  });

  it("blocks with 503 when only username is supplied without password", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DASHBOARD_BASIC_USER", "admin");
    vi.stubEnv("DASHBOARD_BASIC_PASSWORD", "");

    expect(proxy(new NextRequest("https://example.test/dashboard/kis")).status).toBe(503);
  });

  it("allows an explicitly trusted reverse proxy", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TRUST_REVERSE_PROXY", "true");

    expect(proxy(new NextRequest("https://example.test/dashboard/kis")).status).toBe(200);
  });

  it("challenges invalid basic credentials", () => {
    vi.stubEnv("DASHBOARD_BASIC_USER", "viewer");
    vi.stubEnv("DASHBOARD_BASIC_PASSWORD", "secret");
    vi.stubEnv("TRUST_REVERSE_PROXY", "");

    const response = proxy(
      new NextRequest("https://example.test/dashboard/kis", {
        headers: { authorization: `Basic ${btoa("viewer:wrong")}` },
      }),
    );
    expect(response.status).toBe(401);
  });
});
