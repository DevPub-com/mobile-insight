export const modelMetricPrefix = "device_downloads:";
export type ModelMeasure = "downloads" | "installs";

// The existing observation store identifies each series by metricKey.
// Encoding the dimension keeps model names collision-free without mixing totals.
export function modelMetricKey(model: string, measure: ModelMeasure) {
  return `${modelMetricPrefix}${JSON.stringify([model, measure])}`;
}

export function parseModelMetricKey(key: string): { model: string; measure: ModelMeasure } | null {
  if (!key.startsWith(modelMetricPrefix)) return null;
  try {
    const value: unknown = JSON.parse(key.slice(modelMetricPrefix.length));
    if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== "string" || !value[0].trim() || !["downloads", "installs"].includes(value[1])) return null;
    return { model: value[0], measure: value[1] };
  } catch {
    return null;
  }
}
