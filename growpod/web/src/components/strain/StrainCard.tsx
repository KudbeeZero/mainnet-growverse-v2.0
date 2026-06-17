"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useToast } from "@/components/ui/Toast";
import { queryKeys } from "@/lib/queryKeys";
import { RARITY_STYLES, titleCase, num } from "@/lib/format";
import type { Strain } from "@/lib/types";

export function StrainCard({
  strain,
  isFavorite,
}: {
  strain: Strain;
  isFavorite: boolean;
}) {
  const { playerId } = useSession();
  const toast = useToast();
  const qc = useQueryClient();

  const buy = useMutation<unknown, ApiError>({
    mutationFn: () => api.seeds.buy(playerId!, strain.id, 1),
    onSuccess: () => {
      toast.success(`Bought a ${strain.name} seed`);
      qc.invalidateQueries({ queryKey: queryKeys.seeds(playerId!) });
      qc.invalidateQueries({ queryKey: queryKeys.wallet(playerId!) });
    },
    onError: (e) => toast.error(e.message),
  });

  const favorite = useMutation<unknown, ApiError>({
    mutationFn: () =>
      isFavorite
        ? api.strains.removeFavorite(playerId!, strain.id)
        : api.strains.addFavorite(playerId!, strain.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.favorites(playerId!) });
    },
    onError: (e) => toast.error(e.message),
  });

  const mint = useMutation<unknown, ApiError>({
    mutationFn: () => api.strains.mint(playerId!, strain.id),
    onSuccess: () => {
      toast.success("Strain minted as NFT");
      qc.invalidateQueries({ queryKey: ["strains"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const mintable = strain.stability >= 0.85 && strain.rarity !== "common" && strain.rarity !== "uncommon";

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Link
            href={`/lab/strains/${strain.id}`}
            className="font-semibold text-gray-100 hover:text-grow-300"
          >
            {strain.name}
          </Link>
          <div className="text-xs text-gray-500">
            {titleCase(strain.lineage_type)} · Gen {strain.generation}
          </div>
        </div>
        <button
          onClick={() => favorite.mutate()}
          className="text-lg"
          aria-label="toggle favorite"
        >
          {isFavorite ? "⭐" : "☆"}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge className={RARITY_STYLES[strain.rarity]}>{titleCase(strain.rarity)}</Badge>
        {strain.nft_status === "minted" && (
          <Badge className="border-fuchsia-700 bg-fuchsia-900/40 text-fuchsia-200">NFT</Badge>
        )}
        {strain.is_base_catalog && (
          <Badge className="border-ink-600 bg-ink-700 text-gray-400">Catalog</Badge>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-400">
        <Stat label="THC" value={`${num(strain.thc_range[0], 1)}–${num(strain.thc_range[1], 1)}%`} />
        <Stat label="CBD" value={`${num(strain.cbd_range[0], 1)}–${num(strain.cbd_range[1], 1)}%`} />
        <Stat label="Indica" value={`${Math.round(strain.indica_ratio * 100)}%`} />
        <Stat label="Yield" value={`${num(strain.yield_range[0])}–${num(strain.yield_range[1])}g`} />
        <Stat label="Flower" value={`${num(strain.flowering_days[0])}–${num(strain.flowering_days[1])}d`} />
        <Stat label="Stability" value={`${Math.round(strain.stability * 100)}%`} />
      </dl>

      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <Button size="sm" loading={buy.isPending} onClick={() => buy.mutate()}>
          Buy seed
        </Button>
        {mintable && strain.nft_status !== "minted" && (
          <Button size="sm" variant="secondary" loading={mint.isPending} onClick={() => mint.mutate()}>
            Mint NFT
          </Button>
        )}
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt>{label}</dt>
      <dd className="text-gray-200">{value}</dd>
    </div>
  );
}
