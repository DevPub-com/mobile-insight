import { readFile, writeFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";

// Download https://storage.googleapis.com/play_public/supported_devices.csv,
// then run: node --import tsx scripts/update-google-device-catalog.ts <csv-path>
const path = process.argv[2];
if (!path) throw new Error("Pass the downloaded Google supported_devices.csv path.");
const buffer = await readFile(path);
const text = buffer[0] === 0xff && buffer[1] === 0xfe
  ? new TextDecoder("utf-16le").decode(buffer.subarray(2))
  : buffer.toString("utf8").replace(/^\uFEFF/, "");
const rows = parse(text, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
const names = new Map<string, Set<string>>();
for (const row of rows) {
  const code = row.Device;
  const name = row["Marketing Name"];
  if (!code || !name) continue;
  const candidates = names.get(code) ?? new Set<string>();
  candidates.add(name);
  names.set(code, candidates);
}
if (names.size < 1000) throw new Error("Device catalog is unexpectedly small; refusing to replace it.");
const catalog = Object.fromEntries([...names].sort(([a], [b]) => a.localeCompare(b)).map(([code, candidates]) => [code, candidates.size === 1 ? [...candidates][0] : null]));
await writeFile(new URL("../src/data/google-device-catalog.json", import.meta.url), JSON.stringify(catalog) + "\n");
console.info(`Saved ${names.size} device codes; ambiguous codes remain unresolved.`);
