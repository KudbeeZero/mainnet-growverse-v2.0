"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import type { ChamberView } from "@/components/viz/GrowChamber";
import { StatBars } from "./StatBars";
import { ConditionBadges } from "./ConditionBadges";
import { CareButtons } from "./CareButtons";
import { PlantActionCTA } from "./PlantActionCTA";
import { PlantMetrics } from "./PlantMetrics";
import { StageTimelineCompact } from "./StageTimeline";
import { usePlantState } from "@/hooks/usePlantState";
import { useStrainMap } from "@/hooks/queries";
import { useCleanupPlant } from "@/hooks/useCareActions";
import { useTurbo } from "@/hooks/useTurbo";
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

const GrowChamber = dynamic(
  () => import("@/components/viz/GrowChamber").then((m) => m.GrowChamber),
  { ssr: false, loading: () => null },
);

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
  const cleanup = useCleanupPlant();
  const [chamberView, setChamberView] = useState<ChamberView>("chamber");
  // Global speed faucet — now toggleable right here on the dashboard so growth
  // can be sped up (and the plants watched) without diving into the chamber.
  const { enabled: devSpeed, multiplier: turboX, isToggling, toggle: toggleTurbo } =
    useTurbo(playerId);

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
  const budDna = budDnaFor(strain?.slug ?? strain?.name, budColor, strain?.bud_dna);
  const flMid = strain
    ? (strain.flowering_days[0] + strain.flowering_days[1]) / 2
    : 60;
  const liveNominalDay = plant.forecast
    ? nominalGrowDay(plant.growth_stage, plant.forecast.stage_progress_pct, flMid)
    : ageDays(plant.planted_at);
  const dev = previewDev(liveNominalDay, flMid);

  const glowing = devSpeed && plant.is_alive && !plant.harvested;

  return (
    <div className="relative" data-onboarding="plant-card">
      {glowing && (
        <div
          className="pointer-events-none absolute inset-0 rounded-xl"
          style={{
            boxShadow: "0 0 0 2px rgba(74,222,128,0.25), 0 0 18px 4px rgba(74,222,128,0.12)",
            animation: "pulse 2.5s ease-in-out infinite",
          }}
        />
      )}
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

      {plant.harvested ? (
        /* ---- Harvested: empty pot with cleanup CTA ---- */
        <div className="flex h-44 w-full flex-col items-center justify-center gap-3 rounded-lg border border-ink-700 bg-[#050b12]">
          <div className="text-center">
            <div className="text-4xl">🪴</div>
            <p className="mt-1 text-xs text-gray-500">Buds harvested · pod needs cleaning</p>
          </div>
          <button
            onClick={() => cleanup.mutate(plant.id)}
            disabled={cleanup.isPending}
            className="rounded-full border border-amber-600/60 bg-amber-950/40 px-4 py-1.5 text-xs font-semibold text-amber-300 transition-colors hover:border-amber-500 hover:text-amber-200 disabled:opacity-50"
          >
            {cleanup.isPending ? "Cleaning…" : "🧹 Clean Up · 25 🌿"}
          </button>
        </div>
      ) : (
        /* ---- Live plant: grow chamber with bud-view toggle ---- */
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
            view={chamberView}
            budColor={budColor}
            budDna={budDna}
          />
          {(plant.growth_stage === "flowering" || plant.growth_stage === "late_flower" || plant.growth_stage === "harvest") && (
            <button
              onClick={() => setChamberView((v) => (v === "chamber" ? "macro" : "chamber"))}
              className="absolute bottom-2 right-2 z-10 rounded-full border border-ink-600 bg-black/60 px-2.5 py-1 text-[10px] font-semibold text-gray-400 backdrop-blur-sm transition-colors hover:border-grow-500 hover:text-grow-300"
            >
              {chamberView === "chamber" ? "🔬 Buds" : "🌿 Plant"}
            </button>
          )}
          {plant.is_alive && (
            <button
              onClick={() => toggleTurbo(!devSpeed)}
              disabled={isToggling}
              title={`Global ${turboX}× speed ${devSpeed ? "ON" : "OFF"} — accelerates every plant on your account`}
              aria-pressed={devSpeed}
              className={`absolute left-2 top-2 z-10 flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold backdrop-blur-sm transition-colors disabled:opacity-60 ${
                devSpeed
                  ? "border-grow-400/60 bg-grow-700/50 text-grow-100"
                  : "border-ink-600 bg-black/60 text-gray-300 hover:border-grow-500 hover:text-grow-200"
              }`}
            >
              ⚡ {turboX}× {devSpeed ? "ON" : "OFF"}
            </button>
          )}
        </div>
      )}

      {plant.forecast && !plant.harvested && (
        <div className="rounded-md border border-ink-700 bg-ink-900/50 px-2.5 py-2">
          <StageTimelineCompact
            forecast={plant.forecast}
            harvested={plant.harvested}
            isAlive={plant.is_alive}
          />
        </div>
      )}

      <ConditionBadges flags={plant.condition_flags} />
      {plant.metrics && !plant.harvested && (
        <div className="rounded-md border border-ink-700 bg-ink-900/50 px-2.5 py-1.5">
          <PlantMetrics plant={plant} compact />
        </div>
      )}
      {!plant.harvested && <StatBars plant={plant} />}
      <PlantActionCTA plant={plant} pod={pod} compact />
      {!plant.harvested && <CareButtons plant={plant} />}
    </Card>
    </div>
  );
}
