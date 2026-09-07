import type { MetricObservation } from "@/domain/types";

type GoogleDateTime = {
  year?: number;
  month?: number;
  day?: number;
};

type GoogleDecimal = { value?: string | number } | string | number;

export type GoogleVitalsRow = {
  startTime?: GoogleDateTime;
  metrics?: Array<{
    metric?: string;
    decimalValue?: GoogleDecimal;
  }>;
};

type ReportingRequest = <T>(options: {
  method?: "GET" | "POST";
  url: string;
  data?: unknown;
}) => Promise<{ data: T }>;

type MetricSet = {
  freshnessInfo?: {
    freshnesses?: Array<{
      aggregationPeriod?: string;
      latestEndTime?: GoogleDateTime;
    }>;
  };
};

const CRASH_METRIC = "userPerceivedCrashRate28dUserWeighted";
const ANR_METRIC = "userPerceivedAnrRate28dUserWeighted";

function isoDate(value: GoogleDateTime | undefined): string | null {
  if (!value?.year || !value.month || !value.day) return null;
  const date = new Date(Date.UTC(value.year, value.month - 1, value.day));
  if (
    date.getUTCFullYear() !== value.year ||
    date.getUTCMonth() + 1 !== value.month ||
    date.getUTCDate() !== value.day
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function decimalNumber(value: GoogleDecimal | undefined): number | null {
  const raw =
    typeof value === "object" && value !== null ? value.value : value;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeRows(
  appId: string,
  rows: GoogleVitalsRow[],
  apiMetric: string,
  metricKey: string,
  description: string,
  observedAt: string,
): MetricObservation[] {
  return rows.flatMap((row) => {
    const date = isoDate(row.startTime);
    const metric = row.metrics?.find((item) => item.metric === apiMetric);
    const ratio = decimalNumber(metric?.decimalValue);
    if (!date || ratio === null) return [];
    return [{
      appId,
      platform: "android" as const,
      date,
      metricKey,
      value: ratio * 100,
      source: "google_play_api" as const,
      quality: "exact" as const,
      observedAt,
      description,
    }];
  });
}

export function normalizeGoogleVitals(
  appId: string,
  crashRows: GoogleVitalsRow[],
  anrRows: GoogleVitalsRow[],
  observedAt: string,
): MetricObservation[] {
  return [
    ...normalizeRows(
      appId,
      crashRows,
      CRASH_METRIC,
      "user_perceived_crash_rate_28d",
      "Google Play 사용자 인지 비정상 종료 발생률 28일 사용자 가중 평균(%)",
      observedAt,
    ),
    ...normalizeRows(
      appId,
      anrRows,
      ANR_METRIC,
      "user_perceived_anr_rate_28d",
      "Google Play 사용자 인지 ANR 발생률 28일 사용자 가중 평균(%)",
      observedAt,
    ),
  ];
}

function googleDate(date: Date) {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

export async function fetchGoogleVitals(
  app: { id: string; packageName: string },
  request: ReportingRequest,
  now = new Date(),
  days = 90,
): Promise<MetricObservation[]> {
  const fallbackEnd = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  ));
  const packageName = encodeURIComponent(app.packageName);
  const baseUrl = `https://playdeveloperreporting.googleapis.com/v1beta1/apps/${packageName}`;
  const [crashSet, anrSet] = await Promise.all([
    request<MetricSet>({ url: `${baseUrl}/crashRateMetricSet` }),
    request<MetricSet>({ url: `${baseUrl}/anrRateMetricSet` }),
  ]);
  const latestDailyEnd = (set: MetricSet) => {
    const value = set.freshnessInfo?.freshnesses?.find(
      (item) => item.aggregationPeriod === "DAILY",
    )?.latestEndTime;
    const date = isoDate(value);
    return date ? new Date(`${date}T00:00:00.000Z`) : fallbackEnd;
  };
  const query = (
    kind: "crash" | "anr",
    metric: string,
    metricSet: MetricSet,
  ) => {
    const end = latestDailyEnd(metricSet);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - days);
    return request<{ rows?: GoogleVitalsRow[] }>({
      method: "POST",
      url: `${baseUrl}/${kind}RateMetricSet:query`,
      data: {
        timelineSpec: {
          aggregationPeriod: "DAILY",
          startTime: googleDate(start),
          endTime: googleDate(end),
        },
        metrics: [metric],
        pageSize: 1000,
      },
    });
  };
  const [crashes, anrs] = await Promise.all([
    query("crash", CRASH_METRIC, crashSet.data),
    query("anr", ANR_METRIC, anrSet.data),
  ]);
  return normalizeGoogleVitals(
    app.id,
    crashes.data.rows ?? [],
    anrs.data.rows ?? [],
    now.toISOString(),
  );
}
