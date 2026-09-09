import nextEnvPkg from "@next/env";

import { isProduction } from "@/lib/env";

export function loadScriptEnv(projectDir = process.cwd()) {
  const loadConfig = nextEnvPkg.loadEnvConfig;
  return loadConfig(projectDir, !isProduction(), console, true);
}
