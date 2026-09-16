"use client";

import { useEffect, useState } from "react";
import type { AppRelease, Platform } from "@/domain/types";
import type { ReleaseImpactWorkspaceView } from "@/services/mobile/tabs/release-impact.service";

type CrashResult = { value: number | null; change: number | null; sparkline: (number | null)[]; status: "ready" | "error" };

export function useFirebaseReleaseCrashes(appCode: string, releases: AppRelease[], revision: string, enabled: boolean) {
  const requestKey = JSON.stringify({ appCode, revision, releases: (["android", "ios"] as const).flatMap(platform => {
    const release = releases.find(item => item.platform === platform);
    return release ? [{ platform, version: release.version, id: release.id }] : [];
  }) });
  const [result, setResult] = useState<{ key: string; platforms: Partial<Record<Platform, CrashResult>> } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const request = JSON.parse(requestKey) as { appCode: string; releases: { platform: Platform; version: string }[] };
    for (const release of request.releases) {
      const query = new URLSearchParams({ platform: release.platform, version: release.version });
      const save = (value: CrashResult) => {
        if (!controller.signal.aborted) setResult(previous => ({ key: requestKey, platforms: {
          ...(previous?.key === requestKey ? previous.platforms : {}), [release.platform]: value,
        } }));
      };
      fetch(`/api/dashboard/${encodeURIComponent(request.appCode)}/release-impact?${query}`, { signal: controller.signal })
        .then(async response => {
          if (!response.ok) throw new Error("Firebase query failed");
          const body = await response.json() as { data: ReleaseImpactWorkspaceView };
          save({ value: body.data.crashReports.after, change: body.data.crashReports.change,
            sparkline: body.data.daily.filter(point => point.offset >= 0).map(point => point.crashes), status: "ready" });
        }).catch(() => save({ value: null, change: null, sparkline: [], status: "error" }));
    }
    return () => controller.abort();
  }, [requestKey, enabled]);
  return result?.key === requestKey ? result.platforms : {};
}
