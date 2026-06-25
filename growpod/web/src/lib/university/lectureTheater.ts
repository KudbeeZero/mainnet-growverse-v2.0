// Pure helpers for the Narrated Lecture Theater (Phase 2). No React/DOM — kept
// here so the caption-sync + avatar logic is deterministic and unit-testable.

export function fmtTime(s: number): string {
  const safe = Number.isFinite(s) && s > 0 ? s : 0;
  const m = Math.floor(safe / 60);
  const sec = Math.floor(safe % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/** Initials from a faculty name, dropping titles. "Dr. Vera Lindqvist" → "VL". */
export function initials(name: string): string {
  const words = name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w) && !/^(dr|professor|prof)\.?$/i.test(w));
  return words.slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "P";
}

/** Deterministic hue (0..359) from a string — a stable accent per professor. */
export function hueFor(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

/** Index of the caption active at time `t` (last cue whose start has passed), or -1. */
export function activeCueIndex(captions: { start_s: number }[], t: number): number {
  let idx = -1;
  for (let i = 0; i < captions.length; i++) {
    if (t >= captions[i].start_s) idx = i;
    else break;
  }
  return idx;
}
