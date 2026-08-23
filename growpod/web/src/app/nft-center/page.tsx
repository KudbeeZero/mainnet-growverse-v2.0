"use client";

// NFT Lifecycle Center — the single hub for the whole NFT journey.
//
// Ties together the three solid existing panels into one coherent, stateful
// flow, fronted by a visual lifecycle map (LifecycleMap) that shows where every
// harvest/NFT currently sits:
//
//   Harvest ──mint──▶ Minted ──┬─list──▶ Listed ──sell──▶ Traded
//                              └─stake──▶ Curing ──claim──▶ Claimed
//
// It also surfaces the blockchain truth at each stage (ASA id, txid, metadata
// hash, ARC-3 url) so the link between in-game asset and Algorand chain is
// explicit. Async states are polled: PENDING mints refresh until MINTED, curing
// locks tick live until claimable.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingBlock } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/States";
import { Tabs } from "@/components/ui/Tabs";
import { LifecycleMap } from "@/components/nft/LifecycleMap";
import { NFTCollection } from "@/components/nft/NFTCollection";
import { CuringRoom } from "@/components/nft/CuringRoom";
import { HarvestsPanel } from "@/components/harvest/HarvestsPanel";
import { useHarvests, useNFTCollection, usePlayer, useStrainMap } from "@/hooks/queries";
import { useSession } from "@/lib/session";
import { FEATURES } from "@/lib/features";
import type { Stage } from "@/components/nft/LifecycleMap";

function NftCenterInner() {
  const { playerId } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState("journey");

  const harvests = useHarvests();
  const collection = useNFTCollection();
  const player = usePlayer();
  const { map: strainMap } = useStrainMap();

  const hasWallet = !!player.data?.algorand_address;

  // Build the lifecycle map from real data: harvests not yet minted sit at
  // "harvest"; minted/listed/staking assets map to their chain status.
  const journey = useMemo(() => {
    const items: Array<{
      id: string;
      name: string;
      stage: "harvest" | "minted" | "listed" | "curing" | "traded";
      asaId?: number;
      algoValue?: string;
    }> = [];

    for (const h of harvests.data ?? []) {
      if (h.nft_status === "minted") continue; // shown via the collection
      const strain = strainMap.get(h.strain_id);
      items.push({
        id: `harvest-${h.id}`,
        name: strain?.name ?? "Harvest",
        stage: "harvest",
      });
    }
    for (const a of (collection.data as Array<{ asset_id: number; status: string; metadata?: { name?: string }; listing_id?: string | null; game_item_id: string }>) ?? []) {
      const stage =
        a.status === "listed"
          ? "listed"
          : a.status === "staking"
            ? "curing"
            : a.status === "traded"
              ? "traded"
              : "minted";
      items.push({
        id: `nft-${a.asset_id}`,
        name: a.metadata?.name ?? `ASA #${a.asset_id}`,
        stage,
        asaId: a.asset_id,
      });
    }
    return items;
  }, [harvests.data, collection.data]);

  const onEnterCup = (harvestId: string) => {
    router.push(`/cup?harvest=${harvestId}`);
  };

  if (harvests.isLoading || collection.isLoading) {
    return <LoadingBlock label="Loading your NFT journey…" />;
  }
  if (harvests.isError) {
    return <ErrorState error={harvests.error} onRetry={() => harvests.refetch()} />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="NFT LIFECYCLE CENTER"
        title="Your NFT Journey"
        subtitle="Harvest → Mint → List or Cure → Claim. Every asset, end to end."
        action={
          <div className="flex gap-2">
            {!hasWallet && (
              <Link
                href="/profile"
                className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/20"
              >
                🔗 Connect wallet to mint
              </Link>
            )}
            <Link
              href="/market"
              className="rounded-md border border-cyan-500/50 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20"
            >
              🌐 Browse marketplace
            </Link>
          </div>
        }
      />

      {/* Lifecycle map — the at-a-glance "where is everything" view. */}
      <Card>
        <CardHeader
          title="Lifecycle map"
          subtitle="Where every harvest and NFT sits right now"
          action={
            <span className="text-[10px] text-gray-500">
              {journey.length} tracked asset{journey.length !== 1 ? "s" : ""}
            </span>
          }
        />
        <LifecycleMap
          items={journey}
          onStageClick={(stage) => {
            // Jump the tab to the panel that acts on the selected stage.
            if (stage === "harvest") setTab("mint");
            else if (stage === "curing") setTab("curing");
            else setTab("collection");
          }}
        />
      </Card>

      {/* Action panels — the three existing solid panels, tabbed. */}
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "journey", label: "Overview" },
          { key: "mint", label: "Mint" },
          { key: "collection", label: "Collection" },
          { key: "curing", label: "Curing" },
        ]}
      />

      {tab === "journey" && (
        <Card>
          <CardHeader title="How it works" subtitle="From seed to a tradeable Algorand NFT" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Step n={1} title="Grow & harvest" icon="🌿">
              Grow a plant to maturity and harvest it. Quality, weight and rarity are locked at harvest.
            </Step>
            <Step n={2} title="Mint to Algorand" icon="🪙">
              Mint a rare+ harvest into an ARC-3 NFT (ASA) on Algorand. The metadata hash is anchored on-chain.
            </Step>
            <Step n={3} title="List or cure" icon="🏷️⏳">
              List it on the marketplace for ALGO, or lock it in the curing room to earn a bonus GC reward.
            </Step>
            <Step n={4} title="Trade or claim" icon="🤝🎁">
              Sell on the marketplace, or claim your cured NFT + bonus rewards when the cure completes.
            </Step>
          </div>
          {!FEATURES.nftMarketplace && (
            <p className="mt-3 rounded-md border border-ink-700 bg-ink-900/40 p-2 text-[11px] text-gray-500">
              NFT minting is in testnet/mock mode (gated behind <code>NEXT_PUBLIC_ENABLE_NFT_MARKETPLACE</code>).
              Set it to enable live minting.
            </p>
          )}
        </Card>
      )}

      {tab === "mint" && (
        <Card>
          <CardHeader
            title="Mint harvests"
            subtitle={
              hasWallet
                ? "Rare+ harvests can be minted as NFTs."
                : "Connect an Algorand wallet first — an NFT needs an address to belong to."
            }
          />
          {!hasWallet ? (
            <div className="rounded-lg border border-amber-700/40 bg-amber-900/20 p-3 text-sm text-amber-200">
              <p>
                You need an Algorand wallet linked to mint.{" "}
                <Link href="/profile" className="font-semibold underline">
                  Connect one in your profile →
                </Link>
              </p>
            </div>
          ) : (
            <HarvestsPanel onEnterCup={onEnterCup} />
          )}
        </Card>
      )}

      {tab === "collection" && (
        <NFTCollection />
      )}

      {tab === "curing" && (
        <CuringRoom />
      )}

      {/* Blockchain transparency footer. */}
      <Card className="border-ink-700/60 bg-ink-900/40">
        <CardHeader title="⛓ On-chain transparency" subtitle="Every NFT is a real Algorand ASA" />
        <div className="space-y-1 text-xs text-gray-400">
          <p>
            <span className="text-gray-300">Mint:</span> each NFT is an Algorand Standard Asset (ASA) created by the
            game treasury. Its <code className="text-cyan-300">metadata_hash</code> (SHA-256 of the ARC-3 JSON) is
            stored on-chain so the metadata can&apos;t be altered after minting.
          </p>
          <p>
            <span className="text-gray-300">Verify:</span> any ASA id can be looked up on an Algorand block explorer
            (e.g. testnet.algoexplorer.io) — the on-chain hash matches the metadata served at the asset&apos;s ARC-3 url.
          </p>
          <p>
            <span className="text-gray-300">Curing:</span> staking locks the ASA in the treasury contract for the cure
            duration; rewards are posted to the on-chain ledger on claim.
          </p>
        </div>
      </Card>
    </div>
  );
}

function Step({
  n,
  title,
  icon,
  children,
}: {
  n: number;
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-900/40 p-3">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-cyan-500/20 text-[10px] font-bold text-cyan-200">
          {n}
        </span>
        <span className="text-sm" aria-hidden>
          {icon}
        </span>
        <span className="text-sm font-semibold text-gray-200">{title}</span>
      </div>
      <p className="text-xs leading-relaxed text-gray-400">{children}</p>
    </div>
  );
}

export default function NftCenterPage() {
  return (
    <RequireAuth>
      <NftCenterInner />
    </RequireAuth>
  );
}
