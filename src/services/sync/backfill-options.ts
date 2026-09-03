import type { Platform } from "@/domain/types";

export type BackfillOptions = {
  appCode?: string;
  platform?: Platform;
};

export function parseBackfillOptions(args: string[]): BackfillOptions {
  const value = (name: string) =>
    args.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
  const appCode = value("app")?.trim();
  const rawPlatform = value("platform")?.trim();
  if (rawPlatform && rawPlatform !== "android" && rawPlatform !== "ios") {
    throw new Error(`Unsupported platform '${rawPlatform}'. Use android or ios.`);
  }
  return {
    ...(appCode ? { appCode } : {}),
    ...(rawPlatform ? { platform: rawPlatform as Platform } : {}),
  };
}
