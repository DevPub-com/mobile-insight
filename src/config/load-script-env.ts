import nextEnv from "@next/env";

import { isProduction } from "@/lib/env";

const { loadEnvConfig } = nextEnv;

export function loadScriptEnv(projectDir = process.cwd()) {
  return loadEnvConfig(projectDir, !isProduction(), console, true);
}
