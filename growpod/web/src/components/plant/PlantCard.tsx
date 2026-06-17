"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { PlantVisual } from "./PlantVisual";
import { StatBars } from "./StatBars";
import { ConditionBadges } from "./ConditionBadges";
import { CareButtons } from "./CareButtons";
import { PlantActionCTA } from "./PlantActionCTA";
import { PlantMetrics } from "./PlantMetrics";
import { StageTimelineCompact } from "./StageTimeline";
import { usePlantState } from "@/hooks/usePlantState";
import { useStrainMap } from "@/hooks/queries";
import { titleCase, num } from "@/lib/format";
import type { Pod } from "@/lib/types";

export function PlantCard({
  playerId,
  plantId,
  pod,
}: {
  playerId: string;
  plantId: string;
  pod?: Pod | null;
}) {
  const { data: plant, isLoading, isError, error } = usePlantState(playerId, plantId);
  const { map } = useStrainMap();

  if (isLoading) {
    return (
      <Card className="flex h-72 items-center justify-center">
        <Spinner />
      </Card>
    );
  }

  if (isError || !plant) {
    return (
      <Card className="flex h-72 flex-col items-center justify-center gap-2 text-center text-sm text-gray-400">
        <span>Couldn&apos;t load plant.</span>
        <span className="text-xs text-gray-500">{error?.message}</span>
      </Card>
    );
  }

  const strain = map.get(plant.strain_id);
  const stageLabel = titleCase(plant.growth_stage);

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href={`/dashboard/plants/${plant.id}`}
            className="font-semibold text-gray-100 hover:text-grow-300"
          >
            {strain?.name ?? "Unknown strain"}
          </Link>
          <div className="text-xs text-gray-400">
            {stageLabel} · {num(plant.height, 1)} cm
          </div>
        </div>
        {plant.harvested ? (
          <Badge className="border-amber-700 bg-amber-900/50 text-amber-200">Harvested</Badge>
        ) : !plant.is_alive ? (
          <Badge className="border-zinc-600 bg-zinc-800 text-zinc-400">Dead</Badge>
        ) : (
          <Badge className="border-grow-700 bg-grow-900/60 text-grow-200">Growing</Badge>
        )}
      </div>

      <div className="flex items-center justify-center rounded-lg bg-ink-900/60 py-2">
        <PlantVisual stage={plant.growth_stage} flags={plant.condition_flags} size={120} />
      </div>

      {plant.forecast && (
        <div className="rounded-md border border-ink-700 bg-ink-900/50 px-2.5 py-2">
          <StageTimelineCompact
            forecast={plant.forecast}
            harvested={plant.harvested}
            isAlive={plant.is_alive}
          />
        </div>
      )}

      <ConditionBadges flags={plant.condition_flags} />
      {plant.metrics && (
        <div className="rounded-md border border-ink-700 bg-ink-900/50 px-2.5 py-1.5">
          <PlantMetrics plant={plant} compact />
        </div>
      )}
      <StatBars plant={plant} />
      <PlantActionCTA plant={plant} pod={pod} compact />
      <CareButtons plant={plant} />
    </Card>
  );
}
