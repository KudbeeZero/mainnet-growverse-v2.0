import type { Rarity } from "@/lib/types";

export function grow(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  return `${amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} GC`;
}

export function num(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export const RARITY_STYLES: Record<Rarity, string> = {
  common: "bg-ink-700 text-gray-300 border-ink-600",
  uncommon: "bg-emerald-900/50 text-emerald-300 border-emerald-700",
  rare: "bg-sky-900/50 text-sky-300 border-sky-700",
  epic: "bg-fuchsia-900/50 text-fuchsia-300 border-fuchsia-700",
  legendary: "bg-amber-900/50 text-amber-300 border-amber-600",
};

export function titleCase(s: string): string {
  return s.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Hex tint per rarity — for canvas node fills (the constellation motif). */
export const RARITY_HEX: Record<Rarity, string> = {
  common: "#9ca3af",
  uncommon: "#34d399",
  rare: "#38bdf8",
  epic: "#e879f9",
  legendary: "#fbbf24",
};

/** Pill styles for advisor / event severity. Accepts the sim's mild/moderate/severe
 *  as well as the advisor's healthy/minor/serious/critical. */
export const SEVERITY_STYLES: Record<string, string> = {
  healthy: "bg-grow-900/60 text-grow-200 border-grow-700",
  mild: "bg-grow-900/60 text-grow-200 border-grow-700",
  minor: "bg-amber-900/50 text-amber-200 border-amber-700",
  moderate: "bg-amber-900/50 text-amber-200 border-amber-700",
  serious: "bg-orange-900/50 text-orange-200 border-orange-700",
  severe: "bg-red-900/50 text-red-200 border-red-700",
  critical: "bg-red-900/60 text-red-200 border-red-600",
};

export const URGENCY_STYLES: Record<string, string> = {
  now: "bg-red-900/50 text-red-200 border-red-700",
  soon: "bg-amber-900/50 text-amber-200 border-amber-700",
  optional: "bg-ink-700 text-gray-300 border-ink-600",
};

export function clampPct(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/** Hours (float) → human "2d 3h" / "5h" / "12m". */
export function hours(h: number | null | undefined): string {
  if (h === null || h === undefined || Number.isNaN(h)) return "—";
  if (h <= 0) return "0h";
  const totalMin = Math.round(h * 60);
  const d = Math.floor(totalMin / 1440);
  const hh = Math.floor((totalMin % 1440) / 60);
  const mm = totalMin % 60;
  if (d > 0) return `${d}d ${hh}h`;
  if (hh > 0) return `${hh}h ${mm}m`;
  return `${mm}m`;
}

/** ISO timestamp → ms remaining until then (negative if past). */
export function msUntil(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return t - Date.now();
}

/** ms → "1d 04:12:33" countdown string. */
export function countdown(ms: number): string {
  if (ms <= 0) return "closed";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d > 0 ? `${d}d ` : ""}${pad(h)}:${pad(m)}:${pad(sec)}`;
}
