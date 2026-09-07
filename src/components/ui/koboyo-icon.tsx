import type { CSSProperties } from "react";

export type KoboyoIconName =
  | "a-arrow-up"
  | "arrow-down"
  | "arrow-right"
  | "arrow-up"
  | "bar-chart"
  | "bug"
  | "calendar"
  | "chevron-down"
  | "chevron-left"
  | "chevron-right"
  | "clock"
  | "dashboard"
  | "database"
  | "download"
  | "lightbulb"
  | "message-square"
  | "minus"
  | "package"
  | "phone"
  | "rocket"
  | "search"
  | "send"
  | "settings"
  | "shield-alert"
  | "sliders-horizontal"
  | "sparkles"
  | "star"
  | "trending-up";

export function KoboyoIcon({
  name,
  size = 16,
  className,
}: {
  name: KoboyoIconName;
  size?: number;
  className?: string;
}) {
  const source = `https://koboyo.com/icons/svg/${name}.svg`;
  const style = {
    width: size,
    height: size,
    WebkitMaskImage: `url("${source}")`,
    maskImage: `url("${source}")`,
  } satisfies CSSProperties;

  return (
    <span
      className={["koboyo-icon", className].filter(Boolean).join(" ")}
      style={style}
      aria-hidden="true"
      data-koboyo-icon={name}
    />
  );
}
