import { modelMetricKey, type ModelMeasure } from "@/domain/model-downloads";
import type { MetricObservation } from "@/domain/types";
import { parseNumber } from "@/lib/number";

export function parseGoogleDeviceInstalls(appId: string, rows: Record<string, string>[], observedAt: string): MetricObservation[] {
  const values = new Map<string, MetricObservation>();
  for (const row of rows) {
    const model = row.Device?.trim();
    if (!model || !/^\d{4}-\d{2}-\d{2}$/.test(row.Date ?? "")) continue;
    for (const [column, measure] of [
      ["Daily User Installs", "downloads"],
      ["Daily Device Installs", "installs"],
    ] as const satisfies readonly (readonly [string, ModelMeasure])[]) {
      const value = parseNumber(row[column]);
      if (value === null || value < 0 || !Number.isInteger(value)) continue;
      const metricKey = modelMetricKey(model, measure);
      // One source row per day/model. Repeated rows must not inflate counts.
      values.set(`${row.Date}\u0000${metricKey}`, {
        appId, platform: "android", date: row.Date, metricKey, value,
        source: "google_play_gcs", quality: "exact", observedAt,
        description: `기종 ${model} · ${measure === "installs" ? "일별 기기 설치" : "일별 사용자 설치"}`,
      });
    }
  }
  return [...values.values()];
}
