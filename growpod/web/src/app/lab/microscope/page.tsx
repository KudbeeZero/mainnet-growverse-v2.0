"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingBlock } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/States";
import { Microscope } from "@/components/viz/Microscope";
import { useStrains } from "@/hooks/queries";
import { usePlantState } from "@/hooks/usePlantState";
import { useSession } from "@/lib/session";
import { maturityFromTelemetry } from "@/lib/chamber/microscopeGeometry";
import { budColorForStrain } from "@/lib/chamber/strainVisuals";
import { terpeneInfo } from "@/lib/terpenes";

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function maturityLabel(m: number): { stage: string; advice: string; tone: string } {
  if (m < 0.33)
    return {
      stage: "Clear / immature",
      advice: "Trichome heads are glassy and clear — THC is still building. Too early to harvest.",
      tone: "text-sky-300",
    };
  if (m < 0.7)
    return {
      stage: "Cloudy / milky — peak",
      advice: "Mostly milky heads = peak THC. This is the classic harvest window for an energetic high.",
      tone: "text-gray-100",
    };
  return {
    stage: "Amber — late",
    advice: "Heads are turning amber as THC degrades to CBN. Harvest now for a heavier, couch-lock effect.",
    tone: "text-amber-300",
  };
}

function MicroscopeInner() {
  const strains = useStrains({});
  const { playerId } = useSession();
  const params = useSearchParams();
  // Live-specimen mode: ?plantId=… deep-links a REAL growing plant under the
  // lens (entry point: the chamber's 🔬 Inspect trichomes chip). Strain +
  // maturity then come from the plant's server-truth trichome telemetry
  // instead of free-floating dropdown/slider picks.
  const plantId = params.get("plantId");
  const plantQ = usePlantState(playerId ?? "", plantId ?? "", Boolean(plantId && playerId));
  const plant = plantId ? plantQ.data : undefined;
  const telemetry = plant?.trichomes;
  const liveMaturity = telemetry?.active ? maturityFromTelemetry(telemetry) : telemetry ? 0 : null;

  const [strainId, setStrainId] = useState<string | null>(null);
  const [maturity, setMaturity] = useState(0.5);
  // Seed the bench from the live plant once its state arrives; the player can
  // still scrub the slider afterwards for what-if reads (Re-sync snaps back).
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (!seeded && plant && liveMaturity != null) {
      setStrainId(plant.strain_id);
      setMaturity(liveMaturity);
      setSeeded(true);
    }
  }, [seeded, plant, liveMaturity]);

  const list = strains.data ?? [];
  const selected = useMemo(
    () => list.find((s) => s.id === strainId) ?? list[0],
    [list, strainId],
  );

  const terpenes = selected?.terpenes ?? [];
  const seed = selected ? hashSeed(selected.id) : 1;
  // Authored per-strain bud colour — the SAME source the Grow Chamber renders
  // from (strainVisuals.ts), so purple strains are purple under the lens too.
  const budColor = useMemo(
    () => budColorForStrain(selected?.slug ?? selected?.name, 96, seed),
    [selected, seed],
  );
  const mInfo = maturityLabel(maturity);
  const isLive = liveMaturity != null && Math.abs(maturity - liveMaturity) < 0.005;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="LAB · MICROSCOPE"
        title="Trichome Microscope"
        subtitle="Put a bud under the lens. Drag to pan, scroll to zoom, and hover for the magnifier — resolve the calyxes, pistils, and frosty trichomes down to the terpene droplets."
        action={
          plantId && plant ? (
            <Link href={`/dashboard/plants/${plantId}/chamber`}>
              <Button variant="secondary">← Back to chamber</Button>
            </Link>
          ) : (
            <Link href="/lab">
              <Button variant="secondary">← Strain Lab</Button>
            </Link>
          )
        }
      />

      {strains.isLoading || (plantId && plantQ.isLoading) ? (
        <LoadingBlock label="Loading specimens…" />
      ) : strains.isError ? (
        <ErrorState error={strains.error} onRetry={() => strains.refetch()} />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
          {/* Bench */}
          <Card className="overflow-hidden">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <label className="text-xs text-gray-400">
                Specimen{" "}
                <select
                  value={selected?.id ?? ""}
                  onChange={(e) => setStrainId(e.target.value)}
                  className="ml-1 rounded-md border border-ink-600 bg-ink-900 px-2 py-1 text-sm text-gray-100"
                >
                  {list.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>Trichome maturity</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={maturity}
                  onChange={(e) => setMaturity(parseFloat(e.target.value))}
                  className="accent-grow-400"
                  aria-label="Trichome maturity"
                />
                <span className={`font-mono ${mInfo.tone}`}>{Math.round(maturity * 100)}%</span>
              </div>
              {liveMaturity != null &&
                (isLive ? (
                  <span className="flex items-center gap-1 rounded-full border border-grow-500/40 bg-grow-900/40 px-2 py-0.5 text-[10px] font-bold text-grow-300">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-grow-400" /> LIVE ·
                    your plant
                  </span>
                ) : (
                  <button
                    onClick={() => setMaturity(liveMaturity)}
                    className="rounded-full border border-ink-600 bg-ink-800/80 px-2 py-0.5 text-[10px] font-bold text-gray-300 hover:bg-ink-700"
                    title="Snap the maturity slider back to your plant's live trichome telemetry"
                  >
                    ↺ Re-sync to live ({Math.round(liveMaturity * 100)}%)
                  </button>
                ))}
            </div>
            <div className="h-[460px] w-full">
              {selected && (
                <Microscope
                  seed={seed}
                  terpenes={terpenes}
                  maturity={maturity}
                  budColor={budColor}
                />
              )}
            </div>
          </Card>

          {/* Readout */}
          <div className="space-y-4">
            <Card>
              <CardHeader title="Harvest readiness" />
              <p className={`text-sm font-semibold ${mInfo.tone}`}>{mInfo.stage}</p>
              <p className="mt-1 text-xs text-gray-400">{mInfo.advice}</p>
              {telemetry && isLive && (
                <p className="mt-2 rounded-md border border-grow-500/20 bg-grow-900/20 px-2 py-1.5 text-[11px] text-grow-200">
                  🔬 Grower&apos;s read: {telemetry.recommendation}
                </p>
              )}
              <div className="mt-3 flex items-center gap-1 text-[10px] text-gray-500">
                <span className="text-sky-300">Clear</span>
                <div className="h-1.5 flex-1 rounded-full bg-gradient-to-r from-sky-300 via-gray-200 to-amber-400" />
                <span className="text-amber-300">Amber</span>
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Terpene profile"
                subtitle={selected ? selected.name : undefined}
              />
              {terpenes.length === 0 ? (
                <p className="text-xs text-gray-500">No terpene data recorded for this cultivar.</p>
              ) : (
                <ul className="space-y-2">
                  {terpenes.map((t) => {
                    const info = terpeneInfo(t);
                    return (
                      <li key={t} className="flex gap-2">
                        <span
                          className="mt-1 h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: info.color }}
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-100">{info.name}</div>
                          <div className="text-[11px] text-gray-400">{info.aroma}</div>
                          <div className="text-[11px] text-gray-500">{info.effect}</div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MicroscopePage() {
  return (
    <RequireAuth>
      {/* useSearchParams requires a Suspense boundary in the App Router. */}
      <Suspense fallback={<LoadingBlock label="Loading specimens…" />}>
        <MicroscopeInner />
      </Suspense>
    </RequireAuth>
  );
}
