"use client";

import { useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LoadingBlock } from "@/components/ui/Spinner";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState } from "@/components/ui/States";
import { StrainCard } from "@/components/strain/StrainCard";
import { StrainFilters } from "@/components/strain/StrainFilters";
import { useStrains, useFavorites, useSeeds, useStrainMap, useSeasonalStrains } from "@/hooks/queries";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useSession } from "@/lib/session";
import { queryKeys } from "@/lib/queryKeys";
import { api } from "@/lib/api";
import { grow, titleCase } from "@/lib/format";
import type { StrainFilters as Filters } from "@/lib/api";

function SeasonalCountdown() {
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const diffMs = endOfMonth.getTime() - now.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return (
    <span className="font-mono text-xs text-accent-300">
      {days}d {hours}h left
    </span>
  );
}

function rarityColor(rarity: string) {
  const map: Record<string, string> = {
    common: "border-gray-600 bg-gray-900/50 text-gray-300",
    uncommon: "border-green-700 bg-green-950/50 text-green-300",
    rare: "border-blue-700 bg-blue-950/50 text-blue-300",
    epic: "border-purple-700 bg-purple-950/50 text-purple-300",
    legendary: "border-yellow-600 bg-yellow-950/50 text-yellow-300",
  };
  return map[rarity] ?? map.common;
}

function SeasonalSection() {
  const seasonal = useSeasonalStrains();
  const { playerId, isAuthed } = useSession();

  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const purchase = useApiMutation(
    (seasonalId: string) => api.seasonal.purchase(playerId!, seasonalId),
    {
      invalidate: [queryKeys.seeds(playerId ?? ""), queryKeys.wallet(playerId ?? "")],
      successMessage: "Seed added to your inventory!",
    },
  );

  if (seasonal.isLoading) return <LoadingBlock label="Checking monthly drops…" />;
  if (seasonal.isError || !seasonal.data || seasonal.data.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title="🌟 Monthly Exclusive Drops"
        subtitle={`Available only this month — seeds purchased now can be planted any time.`}
        action={<SeasonalCountdown />}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {seasonal.data.map((s) => (
          <div
            key={s.id}
            className={`rounded-lg border p-4 ${rarityColor(s.strain_rarity)}`}
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-gray-50">{s.strain_name}</div>
                {s.strain_thc_max !== null && (
                  <div className="text-xs text-gray-400">
                    THC up to {s.strain_thc_max.toFixed(1)}%
                  </div>
                )}
              </div>
              <Badge className="shrink-0 border-current bg-transparent text-[10px]">
                {titleCase(s.strain_rarity)}
              </Badge>
            </div>

            {s.strain_terpenes.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1">
                {s.strain_terpenes.slice(0, 3).map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-current/30 bg-current/10 px-1.5 py-0.5 text-[10px]"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="font-mono text-sm font-bold">{grow(s.price_gc)}</span>
              {isAuthed ? (
                <Button
                  size="sm"
                  loading={purchase.isPending && purchasingId === s.id}
                  onClick={() => {
                    setPurchasingId(s.id);
                    purchase.mutate(s.id);
                  }}
                >
                  Buy Seed
                </Button>
              ) : (
                <span className="text-xs text-gray-500">Sign in to purchase</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

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
            <Link href="/lab/microscope">
              <Button variant="secondary">🔬 Microscope</Button>
            </Link>
            <Link href="/lab/genbank">
              <Button variant="secondary">✦ GenBank</Button>
            </Link>
            <Link href="/lab/breed">
              <Button>🧬 Breeding</Button>
            </Link>
          </div>
        }
      />

      <SeasonalSection />

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
