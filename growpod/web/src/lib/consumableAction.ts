// Pure helper for the "use a consumable on this plant" surface.
//
// The store sells consumables (ConsumableInventory) but nothing let a player
// USE the ones they own — GET /players/:id/shop returns the catalog with an
// `owned` count, POST .../plants/:id/apply spends one and applies its effect.
// This resolves, for a given plant, which owned consumables are actually
// usable right now (mirroring the server's guards in
// SimulationService.apply_consumable: living plant + optional stage_req) so the
// UI can show a clear enabled/disabled state with a reason instead of letting
// the server reject the tap.

import type { ConsumableItem } from "@/lib/api/store";
import type { Plant } from "@/lib/types";
import { titleCase } from "@/lib/format";

export interface ConsumableOption extends ConsumableItem {
  /** Usable on this plant right now. */
  applicable: boolean;
  /** Why not, when `applicable` is false (empty otherwise). */
  reason: string;
}

/**
 * The player's OWNED consumables (owned > 0), each annotated with whether it can
 * be applied to `plant` and, if not, why. Terminal plants (harvested/dead) can't
 * take any; a `stage_req` consumable only applies in that growth stage.
 */
export function ownedConsumableOptions(
  items: ConsumableItem[] | undefined,
  plant: Pick<Plant, "growth_stage" | "is_alive" | "harvested"> | null | undefined,
): ConsumableOption[] {
  if (!items || !plant) return [];
  const terminal = plant.harvested || !plant.is_alive;
  return items
    .filter((it) => it.owned > 0)
    .map((it) => {
      let applicable = true;
      let reason = "";
      if (terminal) {
        applicable = false;
        reason = plant.harvested ? "This grow is already harvested" : "This plant didn't survive";
      } else if (it.stage_req && it.stage_req !== plant.growth_stage) {
        applicable = false;
        reason = `Only during ${titleCase(it.stage_req)}`;
      }
      return { ...it, applicable, reason };
    });
}
