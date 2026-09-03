import type {
  GoogleReleaseSummary,
  GoogleTrack,
} from "@/domain/models/google.model";
import type { AppRelease } from "@/domain/types";

export type {
  GoogleReleaseSummary,
  GoogleTrack,
  GoogleTrackRelease,
} from "@/domain/models/google.model";

type PublisherRequest = <T>(options: {
  method?: "GET" | "POST" | "DELETE";
  url: string;
}) => Promise<{ data: T }>;

export function normalizeGoogleReleases(
  appId: string,
  tracks: GoogleTrack[],
  observedAt = new Date(),
): AppRelease[] {
  const candidates = tracks
    .filter((track) => track.track === "production")
    .flatMap((track) =>
      (track.releases ?? []).map((release) => ({
        track: "production",
        release,
      })),
    );
  const byTrackAndVersion = new Map<string, AppRelease>();
  for (const { track, release } of candidates) {
    const version = release.name?.trim() || release.versionCodes?.at(-1);
    const identity = `${track}\u0000${version}`;
    if (!version || byTrackAndVersion.has(identity)) {
      continue;
    }
    const notes = release.releaseNotes ?? [];
    const buildNumber = release.versionCodes?.join(", ") ?? null;
    byTrackAndVersion.set(identity, {
      id: `google-${track}-${release.versionCodes?.join("-") ?? version}`,
      appId,
      platform: "android",
      version,
      releasedAt: observedAt.toISOString(),
      releaseDateSource: "first_observed_at",
      releaseDateEstimated: true,
      status: release.status ?? null,
      track,
      buildNumber,
      releaseNotes:
        notes.find((item) => item.language === "ko-KR")?.text ??
        notes.find((item) => item.text)?.text ??
        null,
      rolloutFraction: release.userFraction ?? null,
      phasedReleaseState: null,
      phasedReleaseDay: null,
    });
  }
  return [...byTrackAndVersion.values()];
}

export function normalizeGoogleReleaseSummaries(
  appId: string,
  summaries: GoogleReleaseSummary[],
  observedAt = new Date(),
): AppRelease[] {
  return summaries
    .filter((summary) => (summary.track ?? "production") === "production")
    .flatMap((summary) => {
      const versionCodes = (summary.activeArtifacts ?? []).flatMap((artifact) =>
        artifact.versionCode == null ? [] : [String(artifact.versionCode)],
      );
      const version = summary.releaseName?.trim() || versionCodes.at(-1);
      if (!version) {
        return [];
      }
      return [
        {
          id: `google-${summary.track ?? "production"}-${versionCodes.join("-") || version}`,
          appId,
          platform: "android" as const,
          version,
          releasedAt: observedAt.toISOString(),
          releaseDateSource: "first_observed_at" as const,
          releaseDateEstimated: true,
          status: summary.releaseLifecycleState ?? null,
          track: "production",
          buildNumber: versionCodes.join(", ") || null,
          releaseNotes: null,
          rolloutFraction: null,
          phasedReleaseState: null,
          phasedReleaseDay: null,
        },
      ];
    });
}

export function mergeGoogleReleaseSources(
  historical: AppRelease[],
  active: AppRelease[],
): AppRelease[] {
  const byTrackAndVersion = new Map(
    historical.map((release) => [`${release.track ?? "production"}\u0000${release.version}`, release]),
  );
  for (const release of active) {
    const identity = `${release.track ?? "production"}\u0000${release.version}`;
    const existing = byTrackAndVersion.get(identity);
    byTrackAndVersion.set(identity, {
      ...existing,
      ...release,
      buildNumber: release.buildNumber ?? existing?.buildNumber ?? null,
      releaseNotes: release.releaseNotes ?? existing?.releaseNotes ?? null,
    });
  }
  return [...byTrackAndVersion.values()];
}

export async function fetchGoogleReleaseData(
  app: { id: string; packageName: string },
  request: PublisherRequest,
  observedAt = new Date(),
): Promise<{ releases: AppRelease[] }> {
  const packageName = encodeURIComponent(app.packageName);
  const edit = await request<{ id?: string }>({
    method: "POST",
    url: `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/edits`,
  });
  if (!edit.data.id) {
    throw new Error("Google Play edit ID가 반환되지 않았습니다.");
  }
  const editId = encodeURIComponent(edit.data.id);
  try {
    const response = await request<{ tracks?: GoogleTrack[] }>({
      url: `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/edits/${editId}/tracks`,
    });
    const tracks = (response.data.tracks ?? []).filter(
      (track) => track.track === "production",
    );
    const historyResults = await Promise.allSettled(
      ["production"].map((track) =>
        request<{ releases?: GoogleReleaseSummary[] }>({
          url: `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/tracks/${encodeURIComponent(track)}/releases`,
        }),
      ),
    );
    const historical = normalizeGoogleReleaseSummaries(
      app.id,
      historyResults.flatMap((result) =>
        result.status === "fulfilled" ? result.value.data.releases ?? [] : [],
      ),
      observedAt,
    );
    const mergedReleases = mergeGoogleReleaseSources(
      historical,
      normalizeGoogleReleases(app.id, tracks, observedAt),
    ).filter((release) => release.track === "production");
    const productionByVersion = new Map(
      mergedReleases.map((release) => [release.version, release]),
    );
    const productionReleases = [...productionByVersion.values()];
    return { releases: productionReleases };
  } finally {
    await request<unknown>({
      method: "DELETE",
      url: `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/edits/${editId}`,
    });
  }
}

export async function fetchGoogleReleases(
  app: { id: string; packageName: string },
  request: PublisherRequest,
  observedAt = new Date(),
): Promise<AppRelease[]> {
  return (await fetchGoogleReleaseData(app, request, observedAt)).releases;
}
