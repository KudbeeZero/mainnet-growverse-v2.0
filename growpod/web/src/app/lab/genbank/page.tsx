"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { LoadingBlock } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/States";
import { PageHeader } from "@/components/ui/PageHeader";
import { Constellation } from "@/components/viz/Constellation";
import { GeneHoverCard, strainHoverContent } from "@/components/viz/GeneHoverCard";
import { genbankGraph } from "@/components/viz/graphAdapters";
import { useStrains } from "@/hooks/queries";
import { RARITY_HEX } from "@/lib/format";

function GenbankInner() {
  const router = useRouter();
  const strains = useStrains({});
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);

  if (strains.isLoading) return <LoadingBlock label="Mapping the galaxy…" />;
  if (strains.isError) return <ErrorState error={strains.error} onRetry={() => strains.refetch()} />;

  const all = strains.data ?? [];
  const { nodes, edges } = genbankGraph(all);
  const hoveredStrain = hover ? all.find((s) => s.id === hover.id) : undefined;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="THE GENBANK"
        title="Cultivar Galaxy"
        subtitle="Every cultivar as one navigable constellation, with pedigree edges linking parents to offspring. The community's genetics as a single galaxy."
        action={
          <Link href="/lab" className="text-sm text-grow-300 hover:underline">
            ← Back to Lab
          </Link>
        }
      />

      <div className="relative">
        <Constellation
          mode="graph"
          nodes={nodes}
          edges={edges}
          height={560}
          caption="CLICK A NODE TO OPEN IT · DRAG TO PAN · SCROLL TO ZOOM"
          onSelect={(id) => router.push(`/lab/strains/${id}`)}
          onHoverNode={setHover}
        />
        {hover && hoveredStrain && (
          <GeneHoverCard x={hover.x} y={hover.y} content={strainHoverContent(hoveredStrain)} />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {Object.entries(RARITY_HEX).map(([rarity, hex]) => (
          <span key={rarity} className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: hex }} />
            {rarity}
          </span>
        ))}
        <span className="instrument-label ml-auto">{nodes.length} CULTIVARS MAPPED</span>
      </div>
    </div>
  );
}

export default function GenbankPage() {
  return (
    <RequireAuth>
      <GenbankInner />
    </RequireAuth>
  );
}
