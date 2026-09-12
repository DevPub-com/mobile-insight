import * as nextEnv from "@next/env";

import { isProduction } from "@/lib/env";

export function loadScriptEnv(projectDir = process.cwd()) {
  const loadConfig =
    "loadEnvConfig" in nextEnv && typeof nextEnv.loadEnvConfig === "function"
      ? nextEnv.loadEnvConfig
      : "default" in nextEnv &&
          typeof nextEnv.default === "object" &&
          nextEnv.default !== null &&
          "loadEnvConfig" in nextEnv.default &&
          typeof nextEnv.default.loadEnvConfig === "function"
        ? nextEnv.default.loadEnvConfig
        : undefined;

  if (!loadConfig) {
    throw new Error("Unable to resolve loadEnvConfig from @next/env");
  }
  return loadConfig(projectDir, !isProduction(), console, true);
}
