"use client";

import { use, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingBlock } from "@/components/ui/Spinner";
import { ErrorState, EmptyState } from "@/components/ui/States";
import { Tabs } from "@/components/ui/Tabs";
import { Stat } from "@/components/ui/Metric";
import { RarityChip, VerifyBadge } from "@/components/ui/Pills";
import { Constellation } from "@/components/viz/Constellation";
import { genomeGraph, lineageGraph } from "@/components/viz/graphAdapters";
import {
  useStrain,
  useStrainKnowledge,
  useProvenance,
  useLineage,
} from "@/hooks/queries";
import { useApiMutation } from "@/hooks/useApiMutation";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { queryKeys } from "@/lib/queryKeys";
import { num, titleCase, dateTime } from "@/lib/format";
import { formatScalar, humanizeKnowledgeKey, humanizeList } from "@/lib/knowledgeFormat";
import type { Strain } from "@/lib/types";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { morphologyFor, seedForPlant } from "@/lib/chamber/morphology";
import { budColorForStrain } from "@/lib/chamber/strainVisuals";
import { budDnaFor } from "@/lib/chamber/budDna";

// The catalog hero bud is the 3D frost+pistil render (BudGL pipeline), loaded
// client-side only (three.js touches window).
const StrainBud3D = dynamic(
  () => import("@/components/viz/StrainBud3D").then((m) => m.StrainBud3D),
  { ssr: false, loading: () => <LoadingBlock label="Frosting the bud…" /> },
);

function StrainInner({ strainId }: { strainId: string }) {
  const { playerId } = useSession();
  const strain = useStrain(strainId);
  const [tab, setTab] = useState("encyclopedia");

  const buy = useApiMutation(() => api.seeds.buy(playerId!, strainId, 1), {
    invalidate: [queryKeys.seeds(playerId ?? ""), queryKeys.wallet(playerId ?? "")],
    successMessage: "Seed added to inventory",
  });

  if (strain.isLoading) return <LoadingBlock label="Loading strain…" />;
  if (strain.isError || !strain.data)
    return <ErrorState error={strain.error} onRetry={() => strain.refetch()} />;

  const s = strain.data;

  return (
    <div className="space-y-5">
      <Link href="/lab" className="text-sm text-grow-300 hover:underline">
        ← Back to Strain Lab
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="instrument-label mb-1">
            {titleCase(s.lineage_type)} · GEN {s.generation}
          </div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-gray-50">
            {s.name}
            <RarityChip rarity={s.rarity} />
          </h1>
        </div>
        <Button loading={buy.isPending} onClick={() => buy.mutate()}>
          Buy seed
        </Button>
      </div>

      <StrainHero strain={s} />

      <Card>
        <div className="grid grid-cols-2 gap-x-6 sm:grid-cols-3">
          <Stat label="THC" value={`${num(s.thc_range[0], 1)}–${num(s.thc_range[1], 1)}%`} />
          <Stat label="CBD" value={`${num(s.cbd_range[0], 1)}–${num(s.cbd_range[1], 1)}%`} />
          <Stat label="Indica" value={`${Math.round(s.indica_ratio * 100)}%`} />
          <Stat label="Yield" value={`${num(s.yield_range[0])}–${num(s.yield_range[1])} g`} />
          <Stat label="Flowering" value={`${num(s.flowering_days[0])}–${num(s.flowering_days[1])} d`} />
          <Stat label="Stability" value={`${Math.round(s.stability * 100)}%`} />
        </div>
        {s.terpenes && s.terpenes.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {s.terpenes.map((t) => (
              <span
                key={t}
                className="rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-xs text-violet-300"
              >
                {titleCase(t)}
              </span>
            ))}
          </div>
        )}
      </Card>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "encyclopedia", label: "Encyclopedia" },
          { key: "dna", label: "DNA" },
          { key: "lineage", label: "Lineage" },
          { key: "verify", label: "Verify" },
        ]}
      />

      {tab === "encyclopedia" && <EncyclopediaTab strainId={strainId} />}
      {tab === "dna" && <DnaTab strainId={strainId} />}
      {tab === "lineage" && <LineageTab strainId={strainId} />}
      {tab === "verify" && <VerifyTab strainId={strainId} />}
    </div>
  );
}

function StrainHero({ strain }: { strain: Strain }) {
  const reducedMotion = usePrefersReducedMotion();
  const morphology = morphologyFor(strain.indica_ratio);
  const budColor = budColorForStrain(strain.slug ?? strain.name, morphology.hue, seedForPlant(strain.id));
  const budDna = budDnaFor(strain.slug ?? strain.name, budColor, strain.bud_dna);
  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-xl border border-ink-700 bg-[#050b12]">
      <StrainBud3D dna={budDna} seed={seedForPlant(strain.slug ?? strain.id)} reducedMotion={reducedMotion} />
    </div>
  );
}

function EncyclopediaTab({ strainId }: { strainId: string }) {
  const kb = useStrainKnowledge(strainId);
  if (kb.isLoading) return <LoadingBlock />;
  if (kb.isError || !kb.data) return <ErrorState error={kb.error} onRetry={() => kb.refetch()} />;
  if (!kb.data.in_knowledge_base || !kb.data.knowledge)
    return (
      <EmptyState
        icon="📖"
        title="No encyclopedia entry"
        hint={
          kb.data.note ??
          "This is a player-bred strain — its story is its verifiable lineage. Check the Lineage and Verify tabs."
        }
      />
    );
  return (
    <Card>
      <CardHeader title="Scientist-grade encyclopedia" subtitle="Lineage, sensory & effect profile, cannabinoids, terpenes, cultivation" />
      <KnowledgeRenderer data={kb.data.knowledge} />
    </Card>
  );
}

function KnowledgeRenderer({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="space-y-4">
      {Object.entries(data).map(([key, value]) => (
        <div key={key}>
          <div className="instrument-label mb-1">{titleCase(key)}</div>
          <KnowledgeValue value={value} />
        </div>
      ))}
    </div>
  );
}

function KnowledgeValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="text-gray-500">—</span>;
  if (Array.isArray(value)) {
    // Scalar lists render as readable chips; lists holding objects recurse.
    const joined = humanizeList(value);
    if (joined !== null)
      return (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v, i) => (
            <span key={i} className="rounded-full border border-ink-600 bg-ink-800 px-2 py-0.5 text-xs text-gray-300">
              {formatScalar(v)}
            </span>
          ))}
        </div>
      );
    return (
      <div className="space-y-2">
        {value.map((v, i) => (
          <KnowledgeValue key={i} value={v} />
        ))}
      </div>
    );
  }
  if (typeof value === "object")
    return (
      <div className="space-y-1 rounded-md border border-ink-700 bg-ink-900/50 p-2">
        {Object.entries(value as Record<string, unknown>).map(([k, v]) =>
          v !== null && typeof v === "object" ? (
            <div key={k}>
              <div className="instrument-label mb-1 text-[10px]">{humanizeKnowledgeKey(k)}</div>
              <KnowledgeValue value={v} />
            </div>
          ) : (
            <Stat key={k} label={humanizeKnowledgeKey(k)} value={formatScalar(v)} />
          ),
        )}
      </div>
    );
  return <p className="text-sm leading-relaxed text-gray-300">{formatScalar(value)}</p>;
}

function DnaTab({ strainId }: { strainId: string }) {
  const strain = useStrain(strainId);
  if (strain.isLoading) return <LoadingBlock />;
  if (!strain.data) return <ErrorState error={strain.error} />;
  if (!strain.data.genome)
    return <EmptyState icon="🧬" title="No genome data" hint="This strain has no stored genome." />;
  const { nodes, edges } = genomeGraph(strain.data);
  return (
    <div className="space-y-3">
      <Constellation
        mode="graph"
        nodes={nodes}
        edges={edges}
        height={460}
        caption="EACH NODE IS A LOCUS · LUMINOUS HUBS ARE EXPRESSED TRAITS"
      />
      <p className="text-xs text-gray-500">
        Hover a node to read its trait and value. Violet hubs are expressed (high-value) alleles.
        Drag to pan, scroll to zoom.
      </p>
    </div>
  );
}

function LineageTab({ strainId }: { strainId: string }) {
  const lineage = useLineage(strainId);
  if (lineage.isLoading) return <LoadingBlock label="Replaying the family tree…" />;
  if (lineage.isError || !lineage.data)
    return <ErrorState error={lineage.error} onRetry={() => lineage.refetch()} />;
  const data = lineage.data;
  const { nodes, edges } = lineageGraph(data, strainId);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <VerifyBadge verifiable={data.node_count > 1 || !data.lineage[0]?.root} verified={data.fully_verified} />
        <span className="instrument-label">
          {data.node_count} NODES · {data.root_count} ROOTS{data.truncated ? " · TRUNCATED" : ""}
        </span>
      </div>
      <Constellation
        mode="graph"
        nodes={nodes}
        edges={edges}
        height={460}
        caption="PEDIGREE · PARENT → CHILD EDGES · ✓ = REPLAY-VERIFIED"
      />
      <Card>
        <CardHeader title="Ancestry" subtitle="Every bred node is replayed from its seed and verified" />
        <ul className="space-y-1.5 text-sm">
          {data.lineage.map((n) => (
            <li
              key={n.strain_id}
              className="flex items-center justify-between gap-2 border-b border-ink-700/60 py-1.5 last:border-0"
            >
              <span className="flex items-center gap-2">
                <Link href={`/lab/strains/${n.strain_id}`} className="text-gray-200 hover:text-grow-300">
                  {n.name}
                </Link>
                <span className="instrument-label">GEN {n.generation}</span>
              </span>
              {n.root ? (
                <VerifyBadge verifiable={false} />
              ) : (
                <VerifyBadge verifiable verified={n.verified} />
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function VerifyTab({ strainId }: { strainId: string }) {
  const prov = useProvenance(strainId);
  if (prov.isLoading) return <LoadingBlock label="Replaying the cross…" />;
  if (prov.isError || !prov.data)
    return <ErrorState error={prov.error} onRetry={() => prov.refetch()} />;
  const p = prov.data;

  return (
    <Card>
      <CardHeader
        title="Provably-fair verification"
        subtitle="Re-derives the genome from the public breeding seed and compares it byte-for-byte"
        action={<VerifyBadge verifiable={p.verifiable} verified={p.verified} />}
      />
      {!p.verifiable ? (
        <p className="text-sm text-gray-400">{p.reason ?? "This strain has no breeding event to verify."}</p>
      ) : (
        <div className="space-y-1">
          <Stat label="Verified" value={p.verified ? "✓ genome matches" : "✕ mismatch"} />
          <Stat label="RNG seed" value={String(p.rng_seed)} />
          <Stat label="Bred at" value={dateTime(p.bred_at)} />
          <Stat label="Max value Δ" value={num(p.max_value_delta, 12)} />
          {p.mismatched_traits && p.mismatched_traits.length > 0 && (
            <Stat label="Mismatched" value={p.mismatched_traits.join(", ")} />
          )}
          {p.method && <p className="mt-2 text-xs text-gray-500">Method: {p.method}</p>}
        </div>
      )}
    </Card>
  );
}

export default function StrainPage({ params }: { params: Promise<{ strainId: string }> }) {
  const { strainId } = use(params);
  return (
    <RequireAuth>
      <StrainInner strainId={strainId} />
    </RequireAuth>
  );
}
