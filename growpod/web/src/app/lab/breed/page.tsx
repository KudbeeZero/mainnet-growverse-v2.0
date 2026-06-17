"use client";

import { useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingBlock } from "@/components/ui/Spinner";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { RarityChip } from "@/components/ui/Pills";
import { Constellation } from "@/components/viz/Constellation";
import { genomeGraph } from "@/components/viz/graphAdapters";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useStrains } from "@/hooks/queries";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { queryKeys } from "@/lib/queryKeys";
import { num } from "@/lib/format";
import type { Strain } from "@/lib/types";

function ParentCloud({ strain, tag }: { strain?: Strain; tag: string }) {
  if (!strain) return null;
  const { nodes, edges } = genomeGraph(strain);
  return (
    <div>
      <div className="instrument-label mb-1">
        {tag} · {strain.name}
      </div>
      <Constellation
        mode="graph"
        nodes={nodes}
        edges={edges}
        height={220}
        showCount={false}
        accent={tag === "PARENT A" ? "#38bdf8" : "#a78bfa"}
      />
    </div>
  );
}

function BreedInner() {
  const { playerId } = useSession();
  const strains = useStrains({});

  const [parentA, setParentA] = useState("");
  const [parentB, setParentB] = useState("");
  const [name, setName] = useState("");
  const [result, setResult] = useState<Strain | null>(null);

  const all = strains.data ?? [];
  const a = parentA || all[0]?.id || "";
  const b = parentB || all[1]?.id || "";
  const aStrain = all.find((s) => s.id === a);
  const bStrain = all.find((s) => s.id === b);
  const bred = all.filter((s) => !s.is_base_catalog);

  const breed = useApiMutation(() => api.breeding.breed(playerId!, a, b, { name: name || undefined }), {
    invalidate: [["strains"], queryKeys.seeds(playerId ?? ""), queryKeys.wallet(playerId ?? "")],
    successMessage: (o) => `Bred "${o.name}"`,
    onSuccess: (o) => setResult(o),
  });

  const stabilize = useApiMutation((strainId: string) => api.strains.stabilize(playerId!, strainId), {
    invalidate: [["strains"]],
    successMessage: (s) => `Stabilized "${s.name}" → ${Math.round(s.stability * 100)}%`,
  });

  if (strains.isLoading) return <LoadingBlock label="Loading strains…" />;

  return (
    <div className="space-y-5">
      <Link href="/lab" className="text-sm text-grow-300 hover:underline">
        ← Back to Strain Lab
      </Link>
      <h1 className="text-2xl font-bold">Breeding &amp; Stabilization</h1>

      <Card>
        <CardHeader
          title="Cross two parents"
          subtitle="Two constellations merge into a child cloud — offspring inherit blended traits; the seed is provably fair."
        />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Parent A">
            <Select value={a} onChange={(e) => setParentA(e.target.value)}>
              {all.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.rarity})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Parent B">
            <Select value={b} onChange={(e) => setParentB(e.target.value)}>
              {all.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.rarity})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Offspring name (optional)">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Auto" />
          </Field>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <ParentCloud strain={aStrain} tag="PARENT A" />
          <ParentCloud strain={bStrain} tag="PARENT B" />
        </div>

        <div className="mt-3">
          <Button loading={breed.isPending} disabled={a === b} onClick={() => breed.mutate()}>
            🧬 Breed (fee applies)
          </Button>
          {a === b && <span className="ml-2 text-xs text-amber-400">Pick two different parents.</span>}
        </div>

        {result && (
          <div className="mt-4 space-y-3 rounded-lg border border-grow-700 bg-grow-900/20 p-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-grow-200">{result.name}</span>
              <RarityChip rarity={result.rarity} />
              <span className="instrument-label">GEN {result.generation}</span>
            </div>
            <div className="text-xs text-gray-400">
              THC {num(result.thc_range[0], 1)}–{num(result.thc_range[1], 1)}% · Stability{" "}
              {Math.round(result.stability * 100)}% · A seed was added to your inventory.
            </div>
            {result.genome && (
              <Constellation
                mode="graph"
                {...genomeGraph(result)}
                height={240}
                caption="OFFSPRING GENOME"
                accent="#76c024"
              />
            )}
            <Link href={`/lab/strains/${result.id}`} className="inline-block text-sm text-grow-300 hover:underline">
              Open in Strain Lab → verify its provenance
            </Link>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Stabilize a bred strain"
          subtitle="Raise stability toward true-breeding so it can be minted as an NFT."
        />
        {bred.length === 0 ? (
          <p className="text-sm text-gray-500">No bred strains yet — cross two parents above first.</p>
        ) : (
          <ul className="space-y-2">
            {bred.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-2 rounded-md border border-ink-700 bg-ink-900/50 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Link href={`/lab/strains/${s.id}`} className="text-sm text-gray-200 hover:text-grow-300">
                    {s.name}
                  </Link>
                  <RarityChip rarity={s.rarity} />
                  <span className="text-xs text-gray-500">stability {Math.round(s.stability * 100)}%</span>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={stabilize.isPending && stabilize.variables === s.id}
                  onClick={() => stabilize.mutate(s.id)}
                >
                  Stabilize
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default function BreedPage() {
  return (
    <RequireAuth>
      <BreedInner />
    </RequireAuth>
  );
}
