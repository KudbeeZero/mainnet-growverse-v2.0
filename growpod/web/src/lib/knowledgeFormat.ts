// Humanize the scientist-grade strain "knowledge" blob for display.
//
// The encyclopedia data is a loosely-typed YAML→JSON tree (scalars, string
// arrays, and nested objects like `grow.optimal`). The strain page used to fall
// back to `JSON.stringify`, leaking raw `["indoor","greenhouse"]` and
// `{"dli":"35-45",...}` into the UI. These pure helpers turn that tree into
// readable labels + values, and are unit-tested.

import { titleCase } from "@/lib/format";

/** Nice labels (with units) for the well-known cultivation sub-keys; anything
 *  not listed falls back to titleCase. */
const KEY_LABELS: Record<string, string> = {
  temp_c: "Temp (°C)",
  rh_veg_pct: "RH · veg (%)",
  rh_flower_pct: "RH · flower (%)",
  vpd_kpa: "VPD (kPa)",
  dli: "DLI (mol/m²/d)",
  ppfd: "PPFD",
  co2_ppm: "CO₂ (ppm)",
  yield_indoor_g_m2: "Yield · indoor (g/m²)",
  yield_outdoor_g_plant: "Yield · outdoor (g/plant)",
  flowering_weeks: "Flowering (weeks)",
  photoperiod: "Photoperiod",
};

/** A readable label for a knowledge key. */
export function humanizeKnowledgeKey(key: string): string {
  return KEY_LABELS[key] ?? titleCase(key.replace(/_/g, " "));
}

/** Format a scalar leaf: hyphen ranges become en-dashes, booleans read as
 *  Yes/No, slug-like tokens get title-cased, everything else stringifies. */
export function formatScalar(value: unknown): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  const s = String(value);
  // "20-26" / "0.8-1.3" → "20–26" (en dash), but leave hyphenated words alone.
  const range = s.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
  if (range) return `${range[1]}–${range[2]}`;
  // lowercase single-word slugs (indoor, greenhouse) → Title Case
  if (/^[a-z][a-z_]*$/.test(s)) return titleCase(s.replace(/_/g, " "));
  return s;
}

/** Join a scalar array into "A · B · C", or null when it holds objects (so the
 *  caller knows to render the array structurally instead). */
export function humanizeList(value: unknown[]): string | null {
  if (value.some((v) => v !== null && typeof v === "object")) return null;
  return value.map(formatScalar).join(" · ");
}
