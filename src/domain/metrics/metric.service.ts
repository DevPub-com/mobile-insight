type PlatformDownloads = {
  android: number | null;
  ios: number | null;
};

export function combinePlatformDownloads({ android, ios }: PlatformDownloads): {
  total: number | null;
  hasData: boolean;
} {
  if (android === null && ios === null) {
    return { total: null, hasData: false };
  }

  return { total: (android ?? 0) + (ios ?? 0), hasData: true };
}
