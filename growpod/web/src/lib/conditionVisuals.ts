import type { ConditionKind, Severity, ConditionFlag } from "@/lib/types";

export type Overlay = "bugs" | "mildew" | "water-sheen" | "rot" | "none";
export type BodyAnim = "sway" | "droop" | "wilt-hard" | "shrivel" | "none";

export interface ConditionVisual {
  label: string;
  /** Tailwind classes for the condition badge. */
  badgeClass: string;
  overlay: Overlay;
  bodyAnim: BodyAnim;
  /** Optional fill tint applied to the plant body SVG. */
  tint?: string;
}

export const CONDITION_VISUALS: Record<ConditionKind, ConditionVisual> = {
  healthy: {
    label: "Healthy",
    badgeClass: "bg-grow-900/60 text-grow-200 border-grow-700",
    overlay: "none",
    bodyAnim: "sway",
  },
  underwatered: {
    label: "Underwatered",
    badgeClass: "bg-amber-900/50 text-amber-200 border-amber-700",
    overlay: "none",
    bodyAnim: "droop",
    tint: "#cdbb6a",
  },
  wilting: {
    label: "Wilting",
    badgeClass: "bg-orange-900/50 text-orange-200 border-orange-700",
    overlay: "none",
    bodyAnim: "wilt-hard",
    tint: "#b88a3a",
  },
  overwatered: {
    label: "Overwatered",
    badgeClass: "bg-sky-900/50 text-sky-200 border-sky-700",
    overlay: "water-sheen",
    bodyAnim: "droop",
  },
  root_rot: {
    label: "Root Rot",
    badgeClass: "bg-stone-800/70 text-stone-300 border-stone-600",
    overlay: "rot",
    bodyAnim: "wilt-hard",
    tint: "#6b5b4b",
  },
  nutrient_deficient: {
    label: "Nutrient Deficient",
    badgeClass: "bg-yellow-900/50 text-yellow-200 border-yellow-700",
    overlay: "none",
    bodyAnim: "sway",
    tint: "#d9d36a",
  },
  nutrient_burn: {
    label: "Nutrient Burn",
    badgeClass: "bg-red-900/50 text-red-200 border-red-700",
    overlay: "none",
    bodyAnim: "sway",
    tint: "#b06a4a",
  },
  pest_infestation: {
    label: "Pest Infestation",
    badgeClass: "bg-lime-900/50 text-lime-200 border-lime-700",
    overlay: "bugs",
    bodyAnim: "sway",
  },
  mildew: {
    label: "Mildew",
    badgeClass: "bg-slate-700/60 text-slate-200 border-slate-500",
    overlay: "mildew",
    bodyAnim: "sway",
  },
  dead: {
    label: "Dead",
    badgeClass: "bg-zinc-800 text-zinc-400 border-zinc-600",
    overlay: "none",
    bodyAnim: "none",
    tint: "#555555",
  },
};

export const SEVERITY_SCALE: Record<Severity, number> = {
  mild: 0.4,
  moderate: 0.7,
  severe: 1,
};

// Higher number = takes precedence for the single body animation.
const BODY_PRIORITY: Record<ConditionKind, number> = {
  dead: 100,
  root_rot: 90,
  wilting: 80,
  underwatered: 70,
  overwatered: 60,
  pest_infestation: 50,
  mildew: 40,
  nutrient_burn: 30,
  nutrient_deficient: 20,
  healthy: 0,
};

/** Pick the flag that should drive the plant body animation/tint. */
export function dominantFlag(flags: ConditionFlag[]): ConditionFlag {
  if (!flags.length) return { condition: "healthy", severity: "mild" };
  return [...flags].sort(
    (a, b) => BODY_PRIORITY[b.condition] - BODY_PRIORITY[a.condition],
  )[0];
}
