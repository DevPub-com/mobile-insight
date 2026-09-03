export type VersionChange = "major" | "minor" | "patch" | "unknown";

function numericVersion(version: string): number[] | null {
  const normalized = version.trim().replace(/^v/i, "");
  if (!/^\d+(?:\.\d+){1,2}$/.test(normalized)) return null;
  return normalized.split(".").map(Number);
}

export function classifyVersionChange(
  currentVersion: string,
  previousVersion: string | null,
): VersionChange {
  if (!previousVersion) return "unknown";
  const current = numericVersion(currentVersion);
  const previous = numericVersion(previousVersion);
  if (!current || !previous) return "unknown";
  const [currentMajor = 0, currentMinor = 0, currentPatch = 0] = current;
  const [previousMajor = 0, previousMinor = 0, previousPatch = 0] = previous;
  if (currentMajor !== previousMajor) return "major";
  if (currentMinor !== previousMinor) return "minor";
  if (currentPatch !== previousPatch) return "patch";
  return "unknown";
}

export function compareVersionsDescending(a: string, b: string): number {
  const left = numericVersion(a);
  const right = numericVersion(b);
  if (left && right) {
    for (let index = 0; index < 3; index += 1) {
      const difference = (right[index] ?? 0) - (left[index] ?? 0);
      if (difference) return difference;
    }
    return 0;
  }
  if (left) return -1;
  if (right) return 1;
  return b.localeCompare(a, undefined, { numeric: true });
}
