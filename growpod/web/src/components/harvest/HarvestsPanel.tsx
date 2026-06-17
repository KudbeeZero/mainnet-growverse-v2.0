"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LoadingBlock } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/States";
import { RarityChip } from "@/components/ui/Pills";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useHarvests, useStrainMap } from "@/hooks/queries";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { queryKeys } from "@/lib/queryKeys";
import { grow, num, titleCase } from "@/lib/format";
import type { Harvest } from "@/lib/types";

export function HarvestsPanel({ onEnterCup }: { onEnterCup?: (harvestId: string) => void }) {
  const harvests = useHarvests();
  if (harvests.isLoading) return <LoadingBlock label="Loading harvests…" />;
  const list = harvests.data ?? [];
  if (list.length === 0)
    return (
      <EmptyState
        icon="🌾"
        title="No harvests yet"
        hint="Grow a plant to maturity, then harvest it to cure, sell, mint, or enter into the Cup."
      />
    );

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {list.map((h) => (
        <HarvestCard key={h.id} harvest={h} onEnterCup={onEnterCup} />
      ))}
    </div>
  );
}

function HarvestCard({
  harvest,
  onEnterCup,
}: {
  harvest: Harvest;
  onEnterCup?: (harvestId: string) => void;
}) {
  const { playerId } = useSession();
  const { map } = useStrainMap();
  const [targetHours, setTargetHours] = useState(48);
  const name = map.get(harvest.strain_id)?.name ?? "Harvest";
  const cure = harvest.cure_status ?? "none";

  const inv = [queryKeys.harvests(playerId ?? ""), queryKeys.wallet(playerId ?? "")];

  const startCure = useApiMutation(
    () => api.harvests.cure(playerId!, harvest.id, targetHours),
    { invalidate: inv, successMessage: "Cure started" },
  );
  const finishCure = useApiMutation(
    () => api.harvests.finishCure(playerId!, harvest.id, false),
    { invalidate: inv, successMessage: "Cure finished — quality improved" },
  );
  const sell = useApiMutation(() => api.harvests.sell(playerId!, harvest.id), {
    invalidate: [...inv, queryKeys.ledger(playerId ?? "")],
    successMessage: (h) => `Sold for ${grow(h.sale_value)}`,
  });
  const mint = useApiMutation(() => api.harvests.mint(playerId!, harvest.id), {
    invalidate: inv,
    successMessage: "Harvest minted as NFT",
  });

  return (
    <div className="panel p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-medium text-gray-100">{name}</span>
        <div className="flex gap-1.5">
          <RarityChip rarity={harvest.rarity} />
          {harvest.sold && <Badge className="border-ink-600 bg-ink-700 text-gray-400">Sold</Badge>}
          {harvest.nft_status === "minted" && (
            <Badge className="border-fuchsia-700 bg-fuchsia-900/40 text-fuchsia-200">NFT</Badge>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-gray-400">
        <span>Weight: <span className="text-gray-200">{num(harvest.weight_g, 1)} g</span></span>
        <span>Quality: <span className="text-gray-200">{num(harvest.quality, 0)}</span></span>
        <span>THC: <span className="text-gray-200">{num(harvest.thc_actual, 1)}%</span></span>
        <span>Cure: <span className="text-gray-200">{titleCase(cure)}</span></span>
      </div>

      {!harvest.sold && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {cure === "none" && (
            <>
              <input
                type="number"
                min={1}
                value={targetHours}
                onChange={(e) => setTargetHours(Number(e.target.value))}
                className="w-20 rounded-md border border-ink-600 bg-ink-900 px-2 py-1 text-xs text-gray-100"
                aria-label="cure hours"
              />
              <Button size="sm" variant="secondary" loading={startCure.isPending} onClick={() => startCure.mutate()}>
                Start cure
              </Button>
            </>
          )}
          {cure === "curing" && (
            <Button size="sm" variant="secondary" loading={finishCure.isPending} onClick={() => finishCure.mutate()}>
              Finish cure
            </Button>
          )}
          <Button size="sm" loading={sell.isPending} onClick={() => sell.mutate()}>
            Sell
          </Button>
          {harvest.nft_status !== "minted" && (
            <Button size="sm" variant="ghost" loading={mint.isPending} onClick={() => mint.mutate()}>
              Mint
            </Button>
          )}
          {onEnterCup && (
            <Button size="sm" variant="ghost" onClick={() => onEnterCup(harvest.id)}>
              🏆 Enter Cup
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
