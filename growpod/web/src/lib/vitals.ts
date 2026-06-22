// Severity banding for a plant vital (water / nutrient level, 0..100) — pure so
// the at-a-glance Care Deck bars colour consistently and stay testable.

export type VitalSeverity = 0 | 1 | 2; // good · low · critical

/** Band a 0..100 level into good (0) / low (1) / critical (2). */
export function vitalSeverity(pct: number): VitalSeverity {
  if (pct < 25) return 2;
  if (pct < 50) return 1;
  return 0;
}

export const VITAL_BAR = ["bg-grow-500", "bg-amber-400", "bg-red-500"] as const;
export const VITAL_TEXT = ["text-grow-300", "text-amber-300", "text-red-300"] as const;
