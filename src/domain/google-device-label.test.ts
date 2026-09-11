import { describe, expect, it } from "vitest";
import { googleDeviceLabel } from "./google-device-label";

describe("Google device names", () => {
  it("resolves official names for the download ranking codes", () => {
    expect(googleDeviceLabel("q8q")).toBe("Galaxy Z Fold8 Ultra (q8q)");
    expect(googleDeviceLabel("b8s")).toBe("Galaxy Z Flip8 (b8s)");
    expect(googleDeviceLabel("a03s")).toBe("Galaxy A03s (a03s)");
  });
  it("does not guess a product for shared or unknown device codes", () => {
    expect(googleDeviceLabel("a02q")).toContain("여러 모델이 공유");
    expect(googleDeviceLabel("2036")).toContain("여러 모델이 공유");
    expect(googleDeviceLabel("unlisted-device")).toBe("unlisted-device (모델명 미확인)");
    expect(googleDeviceLabel("unknown")).toBe("모델 미확인");
    expect(googleDeviceLabel("toString")).toContain("모델명 미확인");
  });
});
