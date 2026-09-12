import type {
  AppleIncludedResource,
  AppleVersionResource,
} from "@/domain/models/apple.model";
import type { AppRelease } from "@/domain/types";

export type {
  AppleIncludedResource,
  AppleVersionResource,
} from "@/domain/models/apple.model";

export function isPublishedAppleVersion(state: string | undefined): boolean {
  return state !== undefined && [
    "READY_FOR_SALE",
    "READY_FOR_DISTRIBUTION",
    "REPLACED_WITH_NEW_VERSION",
  ].includes(state);
}

export function normalizeAppleReleases(
  appId: string,
  versions: AppleVersionResource[],
  included: AppleIncludedResource[],
  _now?: Date,
): AppRelease[] {
  void _now;
  const includedById = new Map(included.map((item) => [item.id, item]));

  return versions.flatMap((version) => {
    const storeReleaseDate = version.attributes.earliestReleaseDate;
    const releasedAt = storeReleaseDate ?? version.attributes.createdDate;
    if (
      version.attributes.platform !== "IOS" ||
      !isPublishedAppleVersion(version.attributes.appStoreState) ||
      !version.attributes.versionString ||
      !releasedAt
    ) {
      return [];
    }

    const localizationId =
      version.relationships?.appStoreVersionLocalizations?.data?.[0]?.id;
    const localization = localizationId
      ? includedById.get(localizationId)
      : undefined;

    const buildId = version.relationships?.build?.data?.id;
    const build = buildId ? includedById.get(buildId) : undefined;

    return [
      {
        id: `apple-${version.id}`,
        appId,
        platform: "ios",
        version: version.attributes.versionString,
        releasedAt: new Date(releasedAt).toISOString(),
        releaseDateSource: storeReleaseDate
          ? ("store_release_date" as const)
          : ("version_created_at" as const),
        releaseDateEstimated: !storeReleaseDate,
        status: version.attributes.appStoreState ?? null,
        track: "production",
        buildNumber: build?.attributes?.version ?? null,
        releaseNotes: localization?.attributes?.whatsNew ?? null,
      },
    ];
  });
}
