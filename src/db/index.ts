import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getDatabaseUrl } from "@/lib/env";
import * as schema from "./schema";

type SqlClient = ReturnType<typeof postgres>;
type Database = ReturnType<typeof drizzle<typeof schema>>;

const globalForDatabase = globalThis as typeof globalThis & {
  mobileInsightSqlClient?: SqlClient;
  mobileInsightDatabase?: Database;
};

export function databaseClientOptions(databaseUrl: string) {
  const isSupabasePooler = new URL(databaseUrl).hostname.endsWith(
    ".pooler.supabase.com",
  );
  return {
    max: 8,
    prepare: !isSupabasePooler,
    idle_timeout: 20,
    connect_timeout: 10,
  };
}

export function getDb() {
  if (globalForDatabase.mobileInsightDatabase) {
    return globalForDatabase.mobileInsightDatabase;
  }
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const client = postgres(databaseUrl, databaseClientOptions(databaseUrl));
  const database = drizzle(client, { schema });
  globalForDatabase.mobileInsightSqlClient = client;
  globalForDatabase.mobileInsightDatabase = database;
  return database;
}
