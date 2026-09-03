import { describe, expect, it } from "vitest";

import { publicSyncError } from "../sync-errors";

describe("publicSyncError", () => {
  it("does not expose SQL or bound parameters", () => {
    expect(publicSyncError("Failed query: insert into x params: secret")).toBe(
      "데이터베이스 동기화에 실패했습니다.",
    );
  });

  it("turns provider errors into actionable permission messages", () => {
    expect(publicSyncError("403 FORBIDDEN_ERROR API key does not allow this request")).toBe(
      "App Store Connect API 키에 필요한 보고서 권한이 없습니다.",
    );
    expect(publicSyncError("storage.objects.list access denied")).toBe(
      "Google Play 보고서 버킷 읽기 권한이 없습니다.",
    );
  });
});
