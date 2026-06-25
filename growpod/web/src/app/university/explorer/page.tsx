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
  DEFAULT_PARAMS,
  type ExplorerParams,
} from "@/lib/chamber3d/explorer/parts";

const AnatomyExplorer = dynamic(
  () => import("@/components/university/AnatomyExplorer").then((m) => m.AnatomyExplorer),
  { ssr: false, loading: () => <LoadingBlock label="Warming up the microscope…" /> },
);

function ExplorerInner() {
  const reducedMotion = usePrefersReducedMotion();
  const [params, setParams] = useState<ExplorerParams>(DEFAULT_PARAMS);

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

      <Card className="relative aspect-square w-full overflow-hidden sm:aspect-[4/3]">
        <AnatomyExplorer params={params} reducedMotion={reducedMotion} />
      </Card>

      <Card className="p-4">
        <ExplorerControls
          params={params}
          onChange={setParams}
          onReset={() => setParams(DEFAULT_PARAMS)}
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
