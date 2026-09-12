import type { AppRelease } from "@/domain/types";
import { isPublishedAppleVersion } from "@/services/apple/apple-releases";

export function isProductionRelease(
  release: Pick<AppRelease, "platform" | "track" | "status">,
): boolean {
  if (release.track !== "production") return false;
  if (release.platform === "ios") return isPublishedAppleVersion(release.status ?? undefined);
  return ["completed", "inProgress", "halted", "RELEASE_LIFECYCLE_STATE_PUBLISHED"].includes(release.status ?? "");
}
