import { siAndroid, siApple } from "simple-icons/icons";

import type { Platform } from "@/domain/types";

export function PlatformIcon({
  platform,
  size = 16,
}: {
  platform: Platform;
  size?: number;
}) {
  const icon = platform === "android" ? siAndroid : siApple;

  return (
    <span
      className={`mi-platform-glyph mi-platform-glyph--${platform}`}
      role="img"
      aria-label={platform === "android" ? "Android" : "iOS"}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d={icon.path} />
      </svg>
    </span>
  );
}
