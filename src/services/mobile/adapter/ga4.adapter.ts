import { JWT } from "google-auth-library";

import { getStoreCredentialProfile } from "@/config/store-config";
import type {
  GoogleAnalyticsReportResponse,
  GoogleServiceAccountCredentials,
} from "@/domain/models/ga4.model";
import type {
  AppInfo,
  DailyMetric,
  Platform,
} from "@/domain/types";
import { normalizeDate, rollingDateRange } from "@/lib/date";
import { getEnvironmentVariable } from "@/lib/env";
import { metricNumber, parseNumber } from "@/lib/number";

export type { GoogleAnalyticsReportResponse as Ga4ReportResponse } from "@/domain/models/ga4.model";
export { rollingDateRange } from "@/lib/date";

function normalizePlatform(value: string | undefined): Platform | null {
  if (value?.toLowerCase() === "android") {
    return "android";
  }
  if (value?.toLowerCase() === "ios") {
    return "ios";
  }
  return null;
}

export function normalizeGa4Report(
  appId: string,
  response: GoogleAnalyticsReportResponse,
): DailyMetric[] {
  return (response.rows ?? []).flatMap((row) => {
    const date = normalizeDate(row.dimensionValues?.[0]?.value);
    const platform = normalizePlatform(row.dimensionValues?.[1]?.value);
    const values = row.metricValues ?? [];
    const active1DayUsers = metricNumber(values[0]?.value);
    const active7DayUsers = metricNumber(values[1]?.value);
    const active28DayUsers = metricNumber(values[2]?.value);
    const sessions = metricNumber(values[3]?.value);
    const newUsers = values[4]?.value ? parseNumber(values[4].value) : null;
    const engagedSessions = values[5]?.value ? parseNumber(values[5].value) : null;
    const averageSessionDuration = values[6]?.value
      ? Number(values[6].value)
      : null;
    const screenPageViews = values[7]?.value
      ? parseNumber(values[7].value)
      : null;

    if (
      !date ||
      !platform ||
      active1DayUsers === null ||
      active7DayUsers === null ||
      active28DayUsers === null ||
      sessions === null
    ) {
      return [];
    }
    return [
      {
        appId,
        platform,
        date,
        downloads: null,
        rating: null,
        ratingCount: null,
        reviewCount: null,
        active1DayUsers,
        active7DayUsers,
        active28DayUsers,
        sessions,
        newUsers,
        engagedSessions,
        averageSessionDuration:
          averageSessionDuration !== null && Number.isFinite(averageSessionDuration)
            ? averageSessionDuration
            : null,
        screenPageViews,
      },
    ];
  });
}

export class Ga4Adapter {
  private createAuth(app: AppInfo): { auth: JWT; propertyId: string } | null {
    const profile = getStoreCredentialProfile(app.code)?.googleAnalytics;
    if (!profile) {
      return null;
    }
    const propertyId = getEnvironmentVariable(profile.propertyIdEnv)?.trim();
    const rawCredentials = getEnvironmentVariable(
      profile.serviceAccountJsonEnv,
    )?.trim();
    if (!propertyId && !rawCredentials) {
      return null;
    }
    if (!propertyId || !rawCredentials) {
      throw new Error(`GA4 credentials are incomplete for app '${app.code}'.`);
    }
    if (!/^\d+$/.test(propertyId)) {
      throw new Error(`GA4 property ID must be numeric for app '${app.code}'.`);
    }

    const credentials = JSON.parse(
      rawCredentials,
    ) as GoogleServiceAccountCredentials;
    if (!credentials.client_email || !credentials.private_key) {
      throw new Error(
        `GA4 service account JSON is invalid for app '${app.code}'.`,
      );
    }
    const auth = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
    });
    return { auth, propertyId };
  }

  async fetch(app: AppInfo, days = 35): Promise<DailyMetric[]> {
    const client = this.createAuth(app);
    if (!client) {
      return [];
    }
    const { auth, propertyId } = client;
    const { startDate, endDate } = rollingDateRange(new Date(), days);
    const response = await auth.request<GoogleAnalyticsReportResponse>({
      url: `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      method: "POST",
      data: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "date" }, { name: "platform" }],
        metrics: [
          { name: "active1DayUsers" },
          { name: "active7DayUsers" },
          { name: "active28DayUsers" },
          { name: "sessions" },
          { name: "newUsers" },
          { name: "engagedSessions" },
          { name: "averageSessionDuration" },
          { name: "screenPageViews" },
        ],
        keepEmptyRows: false,
        limit: "100000",
      },
    });
    return normalizeGa4Report(app.id, response.data);
  }

}
