// Builds AI-scout findings from a plant's LIVE state for the dashboard overlay
// (Phase 2A). The conditions come straight from the plant's real
// `condition_flags`; the note text is enriched with the real advisor report's
// matching suggestion when available. No timeline, no ledger — the specialist
// request stays a mock confirm (Phase 2B adds the real GROW debit).

import type { AdvisorReport, ConditionFlag, ConditionKind } from "@/lib/types";
import { CONDITION_VISUALS } from "@/lib/conditionVisuals";
import type { ScoutFinding } from "@/components/intro/introScript";

/** The specialist a player can summon for each recognized condition. */
const SPECIALIST: Record<ConditionKind, string> = {
  healthy: "Canopy Health Specialist",
  underwatered: "Irrigation Specialist",
  wilting: "Irrigation Specialist",
  overwatered: "Drainage Specialist",
  root_rot: "Root Health Specialist",
  nutrient_deficient: "Nutrient Agronomist",
  nutrient_burn: "Nutrient Agronomist",
  pest_infestation: "Pest Control Specialist",
  mildew: "Canopy Health Specialist",
  dead: "Recovery Specialist",
};

/** Fallback note per condition when no advisor suggestion matches. */
const DEFAULT_NOTE: Record<ConditionKind, string> = {
  healthy: "Vitals look good — no action needed.",
  underwatered: "Soil moisture is running low.",
  wilting: "Severe water stress — leaves are wilting.",
  overwatered: "Soil is waterlogged; roots can't breathe.",
  root_rot: "Root rot risk from prolonged saturation.",
  nutrient_deficient: "Feeding is below target for this stage.",
  nutrient_burn: "Nutrient levels are too hot — risk of burn.",
  pest_infestation: "Pests detected on the foliage.",
  mildew: "Powdery mildew forming on the canopy.",
  dead: "This plant is no longer alive.",
};

/** Display-only consult fee in GROW (mock until Phase 2B). */
const FEE: Record<ConditionKind, number> = {
  healthy: 0,
  underwatered: 25,
  wilting: 45,
  overwatered: 35,
  root_rot: 60,
  nutrient_deficient: 35,
  nutrient_burn: 40,
  pest_infestation: 40,
  mildew: 50,
  dead: 0,
};

// Map a condition to the advisor CareAction that addresses it, so we can pull
// the advisor's grounded `reason` text into the matching scout's note.
const CONDITION_TO_ACTION: Partial<Record<ConditionKind, string>> = {
  underwatered: "water",
  wilting: "water",
  nutrient_deficient: "feed",
  pest_infestation: "treat_pests",
  mildew: "treat_disease",
};

// Spread scouts around the plant so chips don't overlap. Cycled by index.
const ANCHOR_SLOTS: ReadonlyArray<{ xPct: number; yPct: number }> = [
  { xPct: 30, yPct: 50 },
  { xPct: 70, yPct: 38 },
  { xPct: 50, yPct: 26 },
  { xPct: 26, yPct: 30 },
  { xPct: 74, yPct: 60 },
];

/**
 * Turn live `condition_flags` (+ an optional advisor report) into scout findings.
 * `healthy`/`dead` flags are skipped — scouts only surface actionable issues.
 */
export function buildLiveFindings(
  flags: ConditionFlag[],
  advisor?: AdvisorReport,
): ScoutFinding[] {
  const actionable = flags.filter(
    (f) => f.condition !== "healthy" && f.condition !== "dead",
  );

  return actionable.map((flag, i) => {
    const action = CONDITION_TO_ACTION[flag.condition];
    const match = action
      ? advisor?.suggestions.find((s) => s.action === action)
      : undefined;
    return {
      id: `${flag.condition}-${i}`,
      anchor: ANCHOR_SLOTS[i % ANCHOR_SLOTS.length],
      condition: flag.condition,
      note: match?.reason ?? DEFAULT_NOTE[flag.condition] ?? CONDITION_VISUALS[flag.condition].label,
      specialist: SPECIALIST[flag.condition],
      feeGrow: FEE[flag.condition],
    };
  });
}
