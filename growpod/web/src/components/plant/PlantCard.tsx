"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { GrowChamber } from "@/components/viz/GrowChamber";
import { StatBars } from "./StatBars";
import { ConditionBadges } from "./ConditionBadges";
import { CareButtons } from "./CareButtons";
import { PlantActionCTA } from "./PlantActionCTA";
import { PlantMetrics } from "./PlantMetrics";
import { StageTimelineCompact } from "./StageTimeline";
import { usePlantState } from "@/hooks/usePlantState";
import { useStrainMap } from "@/hooks/queries";
import { titleCase, num } from "@/lib/format";
import {
  morphologyFor,
  ageDays,
  previewDev,
  nominalGrowDay,
  seedForPlant,
} from "@/lib/chamber/morphology";
import { silhouetteFor, budColorForStrain } from "@/lib/chamber/strainVisuals";
import { budDnaFor } from "@/lib/chamber/budDna";
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

  const indicaRatio = strain?.indica_ratio ?? 0.5;
  const morphology = morphologyFor(indicaRatio);
  const silhouette = silhouetteFor(strain?.slug ?? strain?.name, indicaRatio);
  const budColor = budColorForStrain(
    strain?.slug ?? strain?.name,
    morphology.hue,
    seedForPlant(plant.strain_id),
  );
  const budDna = budDnaFor(strain?.slug ?? strain?.name, budColor);
  const flMid = strain
    ? (strain.flowering_days[0] + strain.flowering_days[1]) / 2
    : 60;
  const liveNominalDay = plant.forecast
    ? nominalGrowDay(plant.growth_stage, plant.forecast.stage_progress_pct, flMid)
    : ageDays(plant.planted_at);
  const dev = previewDev(liveNominalDay, flMid);

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

      <div className="relative h-44 w-full overflow-hidden rounded-lg bg-[#050b12]">
        <GrowChamber
          seed={seedForPlant(plantId)}
          day={liveNominalDay}
          stage={plant.growth_stage}
          morphology={morphology}
          silhouette={silhouette}
          dev={dev}
          climate={{
            fan: 45,
            temp: pod?.temperature ?? 24,
            hum: pod?.humidity ?? 50,
            co2: pod?.co2_level ?? 800,
          }}
          conditionFlags={plant.condition_flags}
          view="chamber"
          budColor={budColor}
          budDna={budDna}
        />
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
