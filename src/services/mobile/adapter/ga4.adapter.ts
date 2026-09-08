import { JWT } from "google-auth-library";

import { getStoreCredentialProfile } from "@/config/store-config";
import type {
  GoogleAnalyticsReportResponse,
  GoogleServiceAccountCredentials,
} from "@/domain/models/ga4.model";
import type {
  AppInfo,
  DailyMetric,
  DeviceDailyRecord,
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

const dimensionLabel = (value: string | undefined) =>
  value?.trim() || "(empty)";

export function normalizeGa4DeviceReport(
  appId: string,
  response: GoogleAnalyticsReportResponse,
): DeviceDailyRecord[] {
  const records = new Map<string, DeviceDailyRecord>();
  for (const row of response.rows ?? []) {
    const date = normalizeDate(row.dimensionValues?.[0]?.value);
    const platform = normalizePlatform(row.dimensionValues?.[1]?.value);
    const activeUsers = metricNumber(row.metricValues?.[0]?.value);
    if (!date || !platform || activeUsers === null) continue;
    const deviceBrand = dimensionLabel(row.dimensionValues?.[2]?.value);
    const deviceModel = dimensionLabel(row.dimensionValues?.[3]?.value);
    const record = {
      appId,
      platform,
      date,
      deviceBrand,
      deviceModel,
      activeUsers,
    };
    records.set(
      [appId, platform, date, deviceBrand, deviceModel].join("\u0000"),
      record,
    );
  }
  return [...records.values()];
}

type Ga4ReportRequest = {
  dateRanges?: Array<{ startDate: string; endDate: string }>;
  dimensions: Array<{ name: string }>;
  metrics: Array<{ name: string }>;
  keepEmptyRows?: boolean;
  orderBys?: Array<{ dimension: { dimensionName: string } }>;
  returnPropertyQuota?: boolean;
  limit?: string;
  offset?: string;
};

type Ga4Request = <T>(options: {
  url: string;
  method: "POST";
  data: Ga4ReportRequest;
}) => Promise<{ data: T }>;

type Ga4RequestError = {
  response?: {
    status?: number;
    headers?: Record<string, string | undefined>;
  };
};

const retryableGa4Status = new Set([429, 500, 503]);

async function requestGa4Page(
  request: Ga4Request,
  options: Parameters<Ga4Request>[0],
  sleep: (milliseconds: number) => Promise<void>,
) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await request<GoogleAnalyticsReportResponse>(options);
    } catch (error) {
      const response = (error as Ga4RequestError).response;
      if (!response?.status || !retryableGa4Status.has(response.status) || attempt >= 3) {
        throw error;
      }
      const retryAfter = Number(response.headers?.["retry-after"]);
      const delay = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1_000
        : 500 * 2 ** attempt + Math.floor(Math.random() * 250);
      await sleep(delay);
    }
  }
}

function incompleteReportReason(response: GoogleAnalyticsReportResponse) {
  const metadata = response.metadata;
  if (metadata?.dataLossFromOtherRow) return "data loss from high-cardinality rows";
  if (metadata?.subjectToThresholding) return "privacy thresholding";
  if (metadata?.samplingMetadatas?.some((sampling) =>
    Number(sampling.samplesReadCount) < Number(sampling.samplingSpaceSize)
  )) return "sampling";
  return null;
}

export async function fetchPaginatedGa4Report(
  request: Ga4Request,
  url: string,
  data: Ga4ReportRequest,
  pageSize = 250_000,
  sleep = (milliseconds: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, milliseconds)),
): Promise<GoogleAnalyticsReportResponse> {
  const rows = [];
  let offset = 0;
  let rowCount: number | undefined;
  let metadata: GoogleAnalyticsReportResponse["metadata"];
  do {
    const response = await requestGa4Page(request, {
      url,
      method: "POST",
      data: { ...data, limit: String(pageSize), offset: String(offset) },
    }, sleep);
    const incompleteReason = incompleteReportReason(response.data);
    if (incompleteReason) {
      throw new Error(`GA4 report is incomplete due to ${incompleteReason}.`);
    }
    const pageRows = response.data.rows ?? [];
    rows.push(...pageRows);
    if (rowCount !== undefined && response.data.rowCount !== rowCount) {
      throw new Error("GA4 report row count changed during pagination.");
    }
    rowCount ??= response.data.rowCount;
    metadata ??= response.data.metadata;
    offset += pageRows.length;
    if (!pageRows.length || (rowCount !== undefined && offset >= rowCount)) {
      break;
    }
  } while (true);
  return { rows, rowCount: rowCount ?? rows.length, metadata };
}

function relativeDateWindows(days: number, windowDays = 31) {
  const windows: Array<{ startDate: string; endDate: string }> = [];
  for (let oldest = days; oldest >= 1; oldest -= windowDays) {
    const newest = Math.max(1, oldest - windowDays + 1);
    windows.push({
      startDate: `${oldest}daysAgo`,
      endDate: newest === 1 ? "yesterday" : `${newest}daysAgo`,
    });
  }
  return windows;
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
    const response = await auth.request<GoogleAnalyticsReportResponse>({
      url: `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      method: "POST",
      data: {
        dateRanges: [{ startDate: `${days}daysAgo`, endDate: "yesterday" }],
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

  async fetchDeviceActiveUsers(
    app: AppInfo,
    days = 35,
  ): Promise<{
    configured: boolean;
    records: DeviceDailyRecord[];
    startDate: string;
    endDate: string;
  }> {
    const client = this.createAuth(app);
    const fallbackRange = rollingDateRange(new Date(), days);
    if (!client) {
      return { configured: false, records: [], ...fallbackRange };
    }
    const { auth, propertyId } = client;
    const records: DeviceDailyRecord[] = [];
    let timeZone: string | undefined;
    for (const dateRange of relativeDateWindows(days)) {
      const response = await fetchPaginatedGa4Report(
        (options) => auth.request(options),
        `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
        {
          dateRanges: [dateRange],
          dimensions: [
            { name: "date" },
            { name: "platform" },
            { name: "mobileDeviceBranding" },
            { name: "mobileDeviceModel" },
          ],
          metrics: [{ name: "activeUsers" }],
          keepEmptyRows: false,
          orderBys: [
            { dimension: { dimensionName: "date" } },
            { dimension: { dimensionName: "platform" } },
            { dimension: { dimensionName: "mobileDeviceBranding" } },
            { dimension: { dimensionName: "mobileDeviceModel" } },
          ],
          returnPropertyQuota: true,
        },
      );
      if (!response.metadata?.timeZone) {
        throw new Error("GA4 device report is missing the property time zone.");
      }
      if (timeZone && timeZone !== response.metadata.timeZone) {
        throw new Error("GA4 property time zone changed during device sync.");
      }
      timeZone = response.metadata.timeZone;
      records.push(...normalizeGa4DeviceReport(app.id, response));
    }
    const { startDate, endDate } = rollingDateRange(new Date(), days, timeZone);
    return {
      configured: true,
      records,
      startDate,
      endDate,
    };
  }

}
