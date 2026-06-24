// Pure gate for the ACCELERATE TIME / SPEED controls: are they usable, and if
// not, WHY. Surfacing the reason is the whole point — a disabled button with no
// explanation reads as "broken," which is exactly the confusion a tester hit
// ("why can't I fast-forward?").

import type { PlantState } from "@/lib/types";

export interface TimeControlsGate {
  disabled: boolean;
  /** Tester-facing reason the controls are off, or null when usable. */
  reason: string | null;
}

/** Decide whether the time controls are usable for this plant. */
export function timeControlsGate(
  plant: PlantState | undefined | null,
  loading: boolean,
): TimeControlsGate {
  if (loading || !plant) return { disabled: true, reason: "Loading this plant…" };
  if (plant.harvested) return { disabled: true, reason: "Harvested — nothing left to grow." };
  if (!plant.is_alive) return { disabled: true, reason: "This plant has died." };
  return { disabled: false, reason: null };
}
