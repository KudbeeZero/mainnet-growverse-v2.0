import { clamp } from "@/lib/chamber/morphology";
import type { PodEquippedGear } from "@/lib/types";

/**
 * Chamber visuals driven by real equipped gear (ROADMAP_90D week 4, S4). Pure
 * mapping functions only — no fetching, no DOM. Replaces the previously
 * hardcoded `climate={{ fan: 45, ... }}` and cosmetic-only grow-light glow in
 * PodCommandCenter.tsx.
 */

// Visual-only airflow intensity per fan SKU (0..100, feeds ClimateInput.fan /
// canvas wind sway in chamberCore.ts). Ordered by real-world CFM so a bigger
// fan visibly moves more air. No fan equipped -> a low ambient baseline
// (audit E2: "no airflow concept at all" — now there's a visible difference).
const FAN_VISUAL_INTENSITY: Record<string, number> = {
  clip_fan: 30,
  oscillating_fan: 55,
  inline_exhaust_6in: 70,
};
export const NO_FAN_BASELINE = 10;

export function equippedOfCategory(
  equippedGear: PodEquippedGear[] | undefined,
  category: PodEquippedGear["category"],
): PodEquippedGear | undefined {
  return (equippedGear ?? []).find((g) => g.category === category);
}

/** 0..100 visual airflow intensity for the canvas wind/sway model. */
export function fanVisualIntensity(equippedGear: PodEquippedGear[] | undefined): number {
  const fan = equippedOfCategory(equippedGear, "fan");
  if (!fan) return NO_FAN_BASELINE;
  return FAN_VISUAL_INTENSITY[fan.gear_key] ?? NO_FAN_BASELINE;
}

// Substrate tint per soil SKU — the pot's visible medium. No soil equipped
// keeps the prior default dark substrate (no regression for existing pods).
const SOIL_TINT: Record<string, string> = {
  worm_castings: "#3f2f22",
  bat_guano: "#4a3323",
  coco_coir: "#8a5a34",
  super_soil: "#2c2013",
  perlite_mix: "#c9c2b8",
};
const DEFAULT_SOIL_TINT = "#241a12";

/** Pot substrate tint (hex) reflecting the equipped soil, if any. */
export function soilTint(equippedGear: PodEquippedGear[] | undefined): string {
  const soil = equippedOfCategory(equippedGear, "soil");
  const tint = soil && SOIL_TINT[soil.gear_key];
  return tint ?? DEFAULT_SOIL_TINT;
}

// The engine's light band is [300, 900] PPFD (balance.yaml simulation.light);
// map it to a 0.15..1 glow-alpha factor so a stronger equipped light glows
// visibly brighter, and an unlit/no-sensor pod (default 600) reads mid-glow.
export function lightGlowIntensity(ppfd: number | null | undefined): number {
  const value = ppfd ?? 600;
  return clamp(value / 1000, 0.15, 1);
}

const GEAR_ICON: Record<PodEquippedGear["category"], string> = {
  light: "💡",
  fan: "💨",
  soil: "🌱",
};

export interface GearChip {
  key: string;
  icon: string;
  label: string;
}

/** One chip per equipped item (icon + name) for the chamber's gear chip row. */
export function gearChips(equippedGear: PodEquippedGear[] | undefined): GearChip[] {
  return (equippedGear ?? []).map((g) => ({
    key: g.gear_key,
    icon: GEAR_ICON[g.category] ?? "⚙️",
    label: g.name,
  }));
}
