"use client";

// Phase 3 — 3D Anatomy Explorer route (university). Behind RequireAuth; the
// university feature flag still gates the catalog/API. The WebGL canvas is
// loaded via dynamic({ ssr: false }) (three.js touches window), with a calm
// loading block as the SSR/suspense fallback.

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoadingBlock } from "@/components/ui/Spinner";
import { ExplorerControls } from "@/components/university/ExplorerControls";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import {
  ANATOMY_PARTS,
  PART_LABELS,
  EXPLORER_PRESETS,
  DEFAULT_PARAMS,
  type ExplorerParams,
} from "@/lib/chamber3d/explorer/parts";

const DEFAULT_SEED = 4242;

const AnatomyExplorer = dynamic(
  () => import("@/components/university/AnatomyExplorer").then((m) => m.AnatomyExplorer),
  { ssr: false, loading: () => <LoadingBlock label="Warming up the microscope…" /> },
);

function ExplorerInner() {
  const reducedMotion = usePrefersReducedMotion();
  const [params, setParams] = useState<ExplorerParams>(DEFAULT_PARAMS);
  const [seed, setSeed] = useState<number>(DEFAULT_SEED);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="GROWPOD UNIVERSITY · LAB"
        title="3D Anatomy Explorer"
        subtitle="Spin and zoom a real genetics-driven bud. Drag to orbit, scroll to zoom from the whole cola down toward the resin glands."
        action={
          <Link href="/university">
            <Button variant="secondary">← Catalog</Button>
          </Link>
        }
      />

      {/* Lab presets — each stages a bit of anatomy for a lesson. */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Lab presets">
        {EXPLORER_PRESETS.map((preset) => {
          const active = activePreset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                setParams(preset.params);
                setSeed(preset.seed);
                setActivePreset(preset.id);
              }}
              aria-pressed={active}
              title={preset.blurb}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                active
                  ? "border-grow-500 bg-grow-900/70 text-grow-100"
                  : "border-ink-600 bg-ink-800 text-gray-300 hover:border-grow-700 hover:text-gray-100"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <Card className="relative aspect-square w-full overflow-hidden sm:aspect-[4/3]">
        <AnatomyExplorer seed={seed} params={params} reducedMotion={reducedMotion} />
      </Card>

      <Card className="p-4">
        <ExplorerControls
          params={params}
          onChange={(next) => {
            setParams(next);
            setActivePreset(null); // manual tweak → no longer a preset
          }}
          onReset={() => {
            setParams(DEFAULT_PARAMS);
            setSeed(DEFAULT_SEED);
            setActivePreset(null);
          }}
        />
      </Card>

      {/* Anatomy key — also the 2D fallback if WebGL is unavailable. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {ANATOMY_PARTS.map((part) => (
          <Card key={part} className="space-y-1 p-3">
            <h3 className="font-semibold text-gray-100">{PART_LABELS[part].title}</h3>
            <p className="text-sm text-gray-400">{PART_LABELS[part].blurb}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function ExplorerPage() {
  return (
    <RequireAuth>
      <ExplorerInner />
    </RequireAuth>
  );
}
