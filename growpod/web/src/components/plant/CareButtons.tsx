"use client";

import { Button } from "@/components/ui/Button";
import { useCareActions } from "@/hooks/useCareActions";
import { useCareFeedback } from "./CareFeedback";
import type { CareKind } from "./careFeedback";
import type { PlantState } from "@/lib/types";

export function CareButtons({ plant }: { plant: PlantState }) {
  const { care, harvest } = useCareActions(plant.id);
  const { fire, layer } = useCareFeedback();
  const disabled = !plant.is_alive || plant.harvested;
  const canHarvest = plant.growth_stage === "harvest" && !plant.harvested && plant.is_alive;
  const pending = care.isPending ? care.variables : null;

  // Comfortable thumb-zone tap target (≥44px) on phones — these are the most-
  // used actions in the game and previously rendered at ~26px.
  const tap = "min-h-[44px] px-3.5 text-sm";

  // Fire the delight burst the instant the player taps — feedback should feel
  // immediate, not wait on the network round-trip.
  const doCare = (kind: Exclude<CareKind, "harvest">) => {
    fire(kind);
    care.mutate(kind);
  };

  return (
    <div className="relative flex flex-wrap gap-2">
      {layer}
      <Button
        size="sm"
        variant="secondary"
        className={tap}
        disabled={disabled}
        loading={pending === "water"}
        onClick={() => doCare("water")}
      >
        💧 Water
      </Button>
      <Button
        size="sm"
        variant="secondary"
        className={tap}
        disabled={disabled}
        loading={pending === "feed"}
        onClick={() => doCare("feed")}
      >
        🧪 Feed
      </Button>
      <Button
        size="sm"
        variant="secondary"
        className={tap}
        disabled={disabled || plant.pest_level <= 0}
        loading={pending === "treatPests"}
        onClick={() => doCare("treatPests")}
      >
        🐞 Treat Pests
      </Button>
      <Button
        size="sm"
        variant="secondary"
        className={tap}
        disabled={disabled || plant.disease_level <= 0}
        loading={pending === "treatDisease"}
        onClick={() => doCare("treatDisease")}
      >
        🧫 Treat Disease
      </Button>
      {canHarvest && (
        <Button
          size="sm"
          variant="primary"
          className={tap}
          loading={harvest.isPending}
          onClick={() => {
            fire("harvest");
            harvest.mutate({ sell: true });
          }}
        >
          ✂️ Harvest & Sell
        </Button>
      )}
    </div>
  );
}
