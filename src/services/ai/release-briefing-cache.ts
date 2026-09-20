import { createHash } from "node:crypto";
import type { ReleaseImpactWorkspaceView } from "@/services/mobile/tabs/release-impact.service";
import type { ReleaseImpactAiBriefing } from "@/domain/types";

// Bump this version when the analysis prompt or model contract changes.
export function releaseBriefingFingerprint(view: ReleaseImpactWorkspaceView) {
  return createHash("sha256").update(JSON.stringify({
    version: 1,
    releaseVersion: view.release.version,
    platform: view.release.platform,
    releasedAt: view.release.releasedAt,
    previousVersion: view.previousRelease?.version ?? null,
    windows: view.windows,
    coverage: view.coverage,
    downloads: view.downloads,
    downloadDailyAverage: view.downloadDailyAverage,
    crashReports: view.crashReports,
    anrReports: view.anrReports,
    ratings: view.ratings,
    negativeReviews: view.negativeReviews,
    newReviews: view.newReviews,
    stability: view.stability,
    vocKeywords: view.voc,
    representativeReviews: (view.representativeReviews ?? []).map(({ rating, content, version }) => ({ rating, content, version })),
  })).digest("hex");
}

const pending = new Map<string, Promise<ReleaseImpactAiBriefing>>();

// Only share running work: a later request always checks current source data.
export function shareReleaseBriefing(key: string, generate: () => Promise<ReleaseImpactAiBriefing>) {
  const existing = pending.get(key);
  if (existing) return existing;
  const work = Promise.resolve().then(generate);
  pending.set(key, work);
  const clear = () => { if (pending.get(key) === work) pending.delete(key); };
  void work.then(clear, clear);
  return work;
}
