export function isDemoMode(): boolean {
  return process.env.MOBILE_INSIGHT_DEMO_MODE === "true";
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
    username: process.env.DASHBOARD_BASIC_USER,
    password: process.env.DASHBOARD_BASIC_PASSWORD,
  };
}

export function isTrustReverseProxy(): boolean {
  return process.env.TRUST_REVERSE_PROXY === "true";
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function getEnvironmentVariable(name: string): string | undefined {
  return process.env[name];
}
