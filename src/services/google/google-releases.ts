import { isProductionRelease } from "@/services/mobile/common/production-release";
import type {
  GoogleReleaseSummary,
  GoogleTrack,
} from "@/domain/models/google.model";
import type {
  AndroidDeviceType,
  AndroidDistribution,
  AppRelease,
} from "@/domain/types";

export type {
  GoogleReleaseSummary,
  GoogleTrack,
  GoogleTrackRelease,
} from "@/domain/models/google.model";

type PublisherRequest = <T>(options: {
  method?: "GET" | "POST" | "DELETE";
  url: string;
}) => Promise<{ data: T }>;

type TrackCountryAvailability = {
  countries?: Array<{ countryCode?: string }>;
  restOfWorld?: boolean;
};

const FORM_FACTOR_PREFIXES: Record<string, AndroidDeviceType> = {
  wear: "wear",
  tv: "tv",
  automotive: "automotive",
  android_xr: "android_xr",
  google_play_games_pc: "google_play_games_pc",
};

export function normalizeAndroidDistribution(
  appId: string,
  tracks: GoogleTrack[],
  availability: TrackCountryAvailability,
  observedAt: Date,
): AndroidDistribution {
  const productionTracks = tracks.filter(
    (track) =>
      (track.track === "production" || track.track?.endsWith(":production")) &&
      Boolean(track.releases?.length),
  );
  const deviceTypes = new Set<AndroidDeviceType>();
  for (const track of productionTracks) {
    if (track.track === "production") {
      deviceTypes.add("phone_tablet");
      continue;
    }
    const prefix = track.track?.split(":", 1)[0];
    if (prefix && FORM_FACTOR_PREFIXES[prefix]) {
      deviceTypes.add(FORM_FACTOR_PREFIXES[prefix]);
    }
  }
  const countryCodes = [...new Set(
    (availability.countries ?? []).flatMap((item) => {
      const code = item.countryCode?.trim().toUpperCase();
      return code ? [code] : [];
    }),
  )].sort();
  return {
    appId,
    platform: "android",
    countryCodes,
    restOfWorld: availability.restOfWorld ?? false,
    deviceTypes: [...deviceTypes],
    source: "google_play_api",
    quality: "exact",
    observedAt: observedAt.toISOString(),
  };
}

function normalizeGoogleReleaseVersion(name: string | undefined): string | undefined {
  const trimmed = name?.trim();
  // Play release names can contain both the build code and the version name.
  return trimmed?.match(/^\d+\s*\(\s*([^()]+?)\s*\)$/)?.[1] || trimmed || undefined;
}

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
    const version = normalizeGoogleReleaseVersion(release.name) || release.versionCodes?.at(-1);
    const identity = `${track}\u0000${version}`;
    if (!version || byTrackAndVersion.has(identity) || !isProductionRelease({ platform: "android", track, status: release.status })) {
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
    .filter((summary) => isProductionRelease({ platform: "android", track: summary.track ?? "production", status: summary.releaseLifecycleState }))
    .flatMap((summary) => {
      const versionCodes = (summary.activeArtifacts ?? []).flatMap((artifact) =>
        artifact.versionCode == null ? [] : [String(artifact.versionCode)],
      );
      const version = normalizeGoogleReleaseVersion(summary.releaseName) || versionCodes.at(-1);
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
  options: { includeDistribution?: boolean } = {},
): Promise<{
  releases: AppRelease[];
  distribution: AndroidDistribution | null;
  distributionError: string | null;
}> {
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
    const availabilityResult = options.includeDistribution === false
      ? null
      : await request<TrackCountryAvailability>({
        url: `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/edits/${editId}/countryAvailability/production`,
      }).then(
        (value) => ({ status: "fulfilled" as const, value }),
        (reason: unknown) => ({ status: "rejected" as const, reason }),
      );
    const allTracks = response.data.tracks ?? [];
    const tracks = allTracks.filter(
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
    return {
      releases: productionReleases,
      distribution:
        availabilityResult?.status === "fulfilled"
          ? normalizeAndroidDistribution(
              app.id,
              allTracks,
              availabilityResult.value.data,
              observedAt,
            )
          : null,
      distributionError:
        availabilityResult?.status === "rejected"
          ? availabilityResult.reason instanceof Error
            ? availabilityResult.reason.message
            : String(availabilityResult.reason)
          : null,
    };
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
  return (
    await fetchGoogleReleaseData(app, request, observedAt, {
      includeDistribution: false,
    })
  ).releases;
}
