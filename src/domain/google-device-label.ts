import catalog from "@/data/google-device-catalog.json";

// Google Play's public supported_devices.csv, refreshed with
// scripts/update-google-device-catalog.ts. Never infer a product from reviews:
// a single device code can identify several marketed products.
export function googleDeviceLabel(device: string): string {
  const code = device.trim();
  if (!code || code.toLowerCase() === "unknown") return "모델 미확인";
  if (!Object.hasOwn(catalog, code)) return `${code} (모델명 미확인)`;
  const name = (catalog as Record<string, string | null>)[code];
  if (name === null) return `${code} (여러 모델이 공유하는 기종 코드)`;
  return name === code ? name : `${name} (${code})`;
}
