import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { loadScriptEnv } from "../src/config/load-script-env";
import { databaseClientOptions } from "../src/db";
import { getDatabaseUrl } from "../src/lib/env";

loadScriptEnv();

const databaseUrl = getDatabaseUrl();
if (!databaseUrl) throw new Error("DATABASE_URL is not configured.");

const client = postgres(databaseUrl, databaseClientOptions(databaseUrl));
try {
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  console.info("Database migrations applied.");
} finally {
  await client.end();
}
