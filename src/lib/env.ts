export function isDemoMode(): boolean {
  const value = process.env.MOBILE_INSIGHT_DEMO_MODE?.trim().toLowerCase().replace(/^["']|["']$/g, "");
  return value === "true" || value === "1" || value === "yes";
}

export function getDefaultAppCode(): string {
  return process.env.DEFAULT_APP_CODE ?? "kis";
}

export function getSyncSecret(): string | undefined {
  return process.env.SYNC_SECRET ?? process.env.CRON_SECRET;
}

export function getDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL;
}

export function getDashboardBasicCredentials(): {
  username?: string;
  password?: string;
} {
  return {
    username: process.env.DASHBOARD_BASIC_USER?.trim(),
    password: process.env.DASHBOARD_BASIC_PASSWORD?.trim(),
  };
}

export function isTrustReverseProxy(): boolean {
  const value = process.env.TRUST_REVERSE_PROXY?.trim().toLowerCase().replace(/^["']|["']$/g, "");
  return value === "true" || value === "1" || value === "yes" || value === "t";
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function getGeminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY;
}

export function getEnvironmentVariable(name: string): string | undefined {
  return process.env[name];
}
