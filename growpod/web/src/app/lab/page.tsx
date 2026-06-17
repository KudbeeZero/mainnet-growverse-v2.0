"use client";

import { useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingBlock } from "@/components/ui/Spinner";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState } from "@/components/ui/States";
import { StrainCard } from "@/components/strain/StrainCard";
import { StrainFilters } from "@/components/strain/StrainFilters";
import { useStrains, useFavorites, useSeeds, useStrainMap } from "@/hooks/queries";
import type { StrainFilters as Filters } from "@/lib/api";

function LabInner() {
  const [filters, setFilters] = useState<Filters>({});
  const strains = useStrains(filters);
  const favorites = useFavorites();
  const seeds = useSeeds();
  const { map } = useStrainMap();

  const favIds = new Set((favorites.data ?? []).map((s) => s.id));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="GENBANK · GENETICS"
        title="Strain Lab"
        subtitle="Browse the catalog, study the encyclopedia, breed new lines, and verify any cultivar's pedigree."
        action={
          <div className="flex items-center gap-2">
            <Link href="/lab/genbank">
              <Button variant="secondary">✦ GenBank</Button>
            </Link>
            <Link href="/lab/breed">
              <Button>🧬 Breeding</Button>
            </Link>
          </div>
        }
      />

      {seeds.data && seeds.data.length > 0 && (
        <Card>
          <CardHeader title="Your seed inventory" />
          <div className="flex flex-wrap gap-2 text-sm">
            {seeds.data.map((s) => (
              <span
                key={s.id}
                className="rounded-md border border-ink-600 bg-ink-900 px-2.5 py-1 text-gray-300"
              >
                {map.get(s.strain_id)?.name ?? "Strain"} ×{s.quantity}
              </span>
            ))}
          </div>
        </Card>
      )}

      <StrainFilters filters={filters} onChange={setFilters} />

      {strains.isLoading ? (
        <LoadingBlock label="Loading catalog…" />
      ) : strains.isError ? (
        <ErrorState error={strains.error} onRetry={() => strains.refetch()} />
      ) : (
        <>
          <p className="instrument-label">{strains.data?.length ?? 0} STRAINS INDEXED</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {(strains.data ?? []).map((s) => (
              <StrainCard key={s.id} strain={s} isFavorite={favIds.has(s.id)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function LabPage() {
  return (
    <RequireAuth>
      <LabInner />
    </RequireAuth>
  );
}
