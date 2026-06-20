/**
 * Care-feedback choreography — the data behind the little burst of delight that
 * plays when a player tends their plant (water / feed / treat / harvest).
 *
 * Pure + framework-free so it's unit-testable and shared by the visual layer
 * (`CareFeedback.tsx`). No renderer, backend, or economy coupling — this is
 * cosmetic reinforcement only: "I helped my plant."
 */

export type CareKind =
  | "water"
  | "feed"
  | "treatPests"
  | "treatDisease"
  | "prune"
  | "train"
  | "boost"
  | "harvest";

export interface CareFx {
  /** Particle glyphs, cycled across the burst. */
  glyphs: string[];
  /** Particle count at full motion. */
  count: number;
  /** navigator.vibrate pattern (ms) — tactile confirmation on supporting phones. */
  haptic: number | number[];
  /** Accent used for the soft glow pulse behind the action. */
  tone: "grow" | "accent" | "amber";
  /** Screen-reader announcement / intent label. */
  label: string;
}

export const CARE_FX: Record<CareKind, CareFx> = {
  water: { glyphs: ["💧", "💦"], count: 6, haptic: 18, tone: "accent", label: "Watered" },
  feed: { glyphs: ["🧪", "✨"], count: 6, haptic: 22, tone: "grow", label: "Fed" },
  treatPests: { glyphs: ["🐞", "✨"], count: 5, haptic: [12, 40, 12], tone: "amber", label: "Pests treated" },
  treatDisease: { glyphs: ["🧫", "✨"], count: 5, haptic: [12, 40, 12], tone: "amber", label: "Disease treated" },
  // Free care tools — gentle, free reinforcement.
  prune: { glyphs: ["✂️", "🌿"], count: 5, haptic: 18, tone: "grow", label: "Pruned" },
  train: { glyphs: ["🪢", "🌿"], count: 5, haptic: 18, tone: "grow", label: "Trained" },
  boost: { glyphs: ["⚡", "✨"], count: 6, haptic: 22, tone: "accent", label: "Boosted" },
  // The celebration: a fuller, wider, longer spray — the screenshot moment.
  harvest: { glyphs: ["🌾", "✨", "🌿", "⭐"], count: 14, haptic: [20, 30, 20, 30, 40], tone: "grow", label: "Harvested" },
};

export interface Particle {
  id: number;
  glyph: string;
  /** Horizontal drift in px (signed). */
  dx: number;
  /** Animation start delay (ms) so the burst staggers. */
  delay: number;
  /** Animation duration (ms). */
  dur: number;
}

/**
 * Build the particle set for one burst. Under reduced motion we emit a single
 * non-drifting glyph (the visual layer fades it instead of floating it), so the
 * confirmation still lands without large motion. `rnd` is injectable for tests.
 */
export function buildParticles(
  kind: CareKind,
  reducedMotion = false,
  rnd: () => number = Math.random,
): Particle[] {
  const fx = CARE_FX[kind];
  const n = reducedMotion ? 1 : fx.count;
  const spread = kind === "harvest" ? 120 : 54;
  const out: Particle[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: i,
      glyph: fx.glyphs[i % fx.glyphs.length],
      dx: reducedMotion ? 0 : Math.round((rnd() - 0.5) * 2 * spread),
      delay: reducedMotion ? 0 : Math.round(rnd() * 160),
      dur: 700 + Math.round(rnd() * 500),
    });
  }
  return out;
}
