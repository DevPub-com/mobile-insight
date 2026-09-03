import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, test, vi } from "vitest";

import { loadScriptEnv } from "./load-script-env";

const testKey = "MOBILE_INSIGHT_SCRIPT_ENV_TEST";
let fixtureDir: string | undefined;

afterEach(() => {
  delete process.env[testKey];
  vi.unstubAllEnvs();
  if (fixtureDir) rmSync(fixtureDir, { recursive: true, force: true });
  fixtureDir = undefined;
});

test("loads .env.local before .env for standalone scripts", () => {
  vi.stubEnv("NODE_ENV", "development");
  fixtureDir = mkdtempSync(join(tmpdir(), "mobile-insight-env-"));
  writeFileSync(join(fixtureDir, ".env"), `${testKey}=from-env\n`);
  writeFileSync(join(fixtureDir, ".env.local"), `${testKey}=from-env-local\n`);

  loadScriptEnv(fixtureDir);

  expect(process.env[testKey]).toBe("from-env-local");
});
