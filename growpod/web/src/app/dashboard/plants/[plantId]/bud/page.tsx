"use client";

// Bud Viewer — Tier 2, a dedicated top-cola inspection screen. This is where the
// heavy WebGL bud engine (BudGL) lives; the whole-plant Grow Chamber never
// mounts it directly. Deliberately simpler than the Chamber: no climate sliders,
// no growth-day scrubber, no care actions — just the hero bud, its live status,
// and a path into the Lab for the full science breakdown.
//
// Flow: Grow Chamber → (🔬 View Bud) → Bud Viewer → (Open Lab) → Lab.

import { use } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { LoadingBlock } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/States";
import { TrichomeReadout } from "@/components/plant/TrichomeReadout";
import { usePlantState } from "@/hooks/usePlantState";
import { useStrainMap, usePods } from "@/hooks/queries";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useSession } from "@/lib/session";
import {
  ageDays,
  daysToHarvest,
  morphologyFor,
  nominalGrowDay,
  previewDev,
  seedForPlant,
} from "@/lib/chamber/morphology";
import { budColorForStrain } from "@/lib/chamber/strainVisuals";
import { budDnaFor, applyEnvironmentToBudDNA } from "@/lib/chamber/budDna";
import { budParamsFromTrichomes } from "@/lib/chamber/bud3d/serverBud";
import { hasWebGL } from "@/lib/features";
import { titleCase } from "@/lib/format";

const BudGL = dynamic(
  () => import("@/components/viz/BudGL").then((m) => m.BudGL),
  { ssr: false, loading: () => null },
);

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg border border-cyan-400/25 bg-[#08141e]/70 px-3 py-2">
      <span className="text-[9px] font-bold tracking-[0.14em] text-cyan-200/60">{label}</span>
      <span className="text-sm font-bold text-white">{value}</span>
    </div>
  );
}

function BudViewerScreen({ plantId }: { plantId: string }) {
  const { playerId } = useSession();
  const { data: plant, isLoading, isError, error, refetch } = usePlantState(playerId!, plantId);
  const { map } = useStrainMap();
  const { data: pods } = usePods();
  const reducedMotion = usePrefersReducedMotion();

  if (isLoading) return <LoadingBlock label="Focusing the bud…" />;
  if (isError || !plant)
    return (
      <div className="space-y-3 p-6">
        <ErrorState error={error} onRetry={() => refetch()} />
        <Link href={`/dashboard/plants/${plantId}/chamber`} className="text-sm text-grow-300">
          ← Back to chamber
        </Link>
      </div>
    );

  const strain = map.get(plant.strain_id);
  const pod = pods?.find((p) => p.id === plant.pod_id);
  const flMid = strain ? (strain.flowering_days[0] + strain.flowering_days[1]) / 2 : 60;
  const morphology = morphologyFor(strain?.indica_ratio ?? 0.5);
  const budColor = budColorForStrain(strain?.slug ?? strain?.name, morphology.hue, seedForPlant(plant.strain_id));
  const budDna = applyEnvironmentToBudDNA(budDnaFor(strain?.slug ?? strain?.name, budColor, strain?.bud_dna), {
    temp: pod?.temperature ?? 24,
    light: pod?.light_intensity ?? 600,
    humidity: pod?.humidity ?? 50,
    water: plant.water_level,
  });

  // Live-only look (no preview/boost/rewind here — this is a focused inspection
  // screen, not a control surface): the bud's real current development.
  const liveNominalDay = plant.forecast
    ? nominalGrowDay(plant.growth_stage, plant.forecast.stage_progress_pct, flMid)
    : ageDays(plant.planted_at);
  const dev = previewDev(liveNominalDay, flMid);
  const serverBud = budParamsFromTrichomes(plant.trichomes, false);
  const budScalars = {
    budDev: dev.budDev,
    ripe: serverBud?.ripe ?? dev.ripe,
    brown: dev.brown,
    trich: serverBud?.trich ?? dev.trich,
    purple: budColor.anthocyanin ?? 0,
  };
  const harvestDays = plant.forecast
    ? plant.forecast.is_harvest_ready
      ? 0
      : Math.max(1, Math.ceil(plant.forecast.hours_to_harvest / 24))
    : strain
      ? Math.round(daysToHarvest(plant.growth_stage, strain.flowering_days, plant.health))
      : null;
  const readiness = plant.trichomes?.active
    ? titleCase(plant.trichomes.harvest_window.replace("_", " "))
    : titleCase(plant.growth_stage);

  const webgl = hasWebGL();

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-[#050208]">
      <header className="flex flex-none items-center justify-between gap-3 px-4 pb-1 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Link
          href={`/dashboard/plants/${plantId}/chamber`}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-cyan-200/80 hover:bg-white/5 hover:text-cyan-100"
        >
          ← Chamber
        </Link>
        <span className="text-[9px] font-bold tracking-[0.26em] text-cyan-300/70">BUD VIEWER</span>
      </header>

      {/* hero stage — the top cola, large and centered, minimal chrome */}
      <div className="relative min-h-0 flex-1">
        {webgl ? (
          <BudGL
            dna={budDna}
            seed={seedForPlant(plantId)}
            budDev={budScalars.budDev}
            ripe={budScalars.ripe}
            brown={budScalars.brown}
            trich={budScalars.trich}
            purple={budScalars.purple}
            reducedMotion={reducedMotion}
            stage={plant.growth_stage}
            interactive
          />
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-center text-sm text-cyan-200/60">
            This device can&apos;t render the 3D bud viewer. Check the plant from the Grow Chamber instead.
          </div>
        )}
        <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-cyan-400/40 bg-[#08141e]/70 px-2.5 py-1.5 font-mono text-[11px] tracking-wide backdrop-blur">
          {strain?.name ?? "Plant"} · {titleCase(plant.growth_stage)}
        </div>
        {webgl && (
          <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-cyan-200/40">
            Drag to rotate · scroll to zoom
          </p>
        )}
      </div>

      {/* status strip */}
      {/* This page is a full-bleed `fixed inset-0` overlay, so it sits OUTSIDE the
          normal content flow the persistent mobile tab bar (Grow/Lab/Market/Cup)
          reserves space for elsewhere — extra bottom clearance keeps "Open Lab"
          from landing underneath it (same convention as the Chamber's Arcade
          toggle, which clears the tab bar with an explicit ~5.5rem offset). */}
      <div className="flex-none space-y-3 border-t border-[#11212e] bg-gradient-to-t from-[#0a1622] to-transparent px-4 pb-[calc(4.75rem+env(safe-area-inset-bottom))] pt-3 lg:pb-[calc(14px+env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-3 gap-2">
          <StatChip label="READINESS" value={readiness} />
          <StatChip label="TO HARVEST" value={harvestDays !== null ? `${harvestDays}d` : "—"} />
          <StatChip label="HEALTH" value={`${Math.round(plant.health)}%`} />
        </div>

        {plant.trichomes?.active && <TrichomeReadout t={plant.trichomes} />}

        <Link
          href={`/lab/strains/${plant.strain_id}`}
          className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-lg border border-violet-400/50 bg-gradient-to-r from-violet-500/15 to-fuchsia-500/15 text-sm font-bold tracking-[0.04em] text-violet-100 transition-all hover:border-violet-300 hover:from-violet-500/25 hover:to-fuchsia-500/25"
        >
          🧪 Open Lab
        </Link>
      </div>
    </div>
  );
}

export default function BudViewerPage({ params }: { params: Promise<{ plantId: string }> }) {
  const { plantId } = use(params);
  return (
    <RequireAuth>
      <BudViewerScreen plantId={plantId} />
    </RequireAuth>
  );
}
