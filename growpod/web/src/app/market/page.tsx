"use client";

import { useState } from "react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingBlock } from "@/components/ui/Spinner";
import { PageHeader, Section } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/States";
import { Tabs } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { RarityChip } from "@/components/ui/Pills";
import { Countdown } from "@/components/ui/Countdown";
import { ListingCard } from "@/components/market/ListingCard";
import { CreateListingForm } from "@/components/market/CreateListingForm";
import { MarketplaceBrowser } from "@/components/nft/MarketplaceBrowser";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useMarket, useContracts } from "@/hooks/queries";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { FEATURES } from "@/lib/features";
import { queryKeys } from "@/lib/queryKeys";
import { grow, dateTime, titleCase } from "@/lib/format";

function MarketInner() {
  const market = useMarket();
  const [tab, setTab] = useState("fixed");
  const listings = market.data ?? [];
  const fixed = listings.filter((l) => !l.is_auction);
  const auctions = listings.filter((l) => l.is_auction);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="ECONOMY"
        title="Marketplace"
        subtitle="Trade seeds with other growers at a fixed price or by auction, and fulfil NPC contracts for GROW + XP."
      />

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "fixed", label: "Fixed price", badge: fixed.length },
          { key: "auctions", label: "Auctions", badge: auctions.length },
          ...(FEATURES.contracts ? [{ key: "contracts", label: "Contracts" }] : []),
          ...(FEATURES.nftMarketplace ? [{ key: "nft", label: "NFT Market" }] : []),
        ]}
      />

      {tab === "nft" && (
        <Section
          title="NFT marketplace"
          action={
            <span className="text-xs text-gray-500">
              Peer-to-peer trading of minted harvest NFTs — testnet/mock, no real money.
            </span>
          }
        >
          <MarketplaceBrowser />
        </Section>
      )}

      {tab !== "contracts" && tab !== "nft" && (
        <Card className="max-w-2xl">
          <CardHeader title="Sell a seed" subtitle="List at a fixed price or open an auction" />
          <CreateListingForm />
        </Card>
      )}

      {tab === "fixed" && (
        <Section title="Fixed-price listings">
          {market.isLoading ? (
            <LoadingBlock />
          ) : fixed.length === 0 ? (
            <EmptyState icon="🏷️" title="No fixed listings" hint="Be the first to list a seed for sale." />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {fixed.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          )}
        </Section>
      )}

      {tab === "auctions" && (
        <Section title="Live auctions">
          {market.isLoading ? (
            <LoadingBlock />
          ) : auctions.length === 0 ? (
            <EmptyState icon="🔨" title="No live auctions" hint="Open an auction to let growers bid." />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {auctions.map((l) => (
                <div key={l.id} className="relative">
                  {l.expires_at && (
                    <div className="instrument-label absolute right-3 top-3 z-10">
                      <Countdown to={l.expires_at} />
                    </div>
                  )}
                  <ListingCard listing={l} />
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {tab === "contracts" && <ContractsTab />}
    </div>
  );
}

function ContractsTab() {
  const { playerId } = useSession();
  const contracts = useContracts();

  const refresh = [
    queryKeys.contracts(playerId ?? "", undefined),
    queryKeys.wallet(playerId ?? ""),
    queryKeys.player(playerId ?? ""),
  ];

  const offer = useApiMutation(() => api.contracts.offer(playerId!), {
    invalidate: refresh,
    successMessage: "New contract offered",
  });
  const fulfill = useApiMutation((id: string) => api.contracts.fulfill(playerId!, id), {
    invalidate: refresh,
    successMessage: "Contract fulfilled — reward paid",
  });

  return (
    <Section
      title="NPC contracts"
      action={
        <Button size="sm" onClick={() => offer.mutate()} loading={offer.isPending}>
          Request contract
        </Button>
      }
    >
      {contracts.isLoading ? (
        <LoadingBlock />
      ) : (contracts.data ?? []).length === 0 ? (
        <EmptyState icon="📄" title="No contracts yet" hint="Request one to get a delivery order." />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {(contracts.data ?? []).map((c) => (
            <Card key={c.id}>
              <CardHeader
                title={c.description}
                action={
                  <Badge className="border-ink-600 bg-ink-700 text-gray-300">
                    {titleCase(c.status)}
                  </Badge>
                }
              />
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-300">
                {c.target_rarity && <RarityChip rarity={c.target_rarity} />}
                <span>{c.target_grams} g</span>
                <span className="text-grow-300">Reward {grow(c.reward_grow)}</span>
                <span className="text-gray-500">+{c.reward_xp} XP</span>
              </div>
              <div className="mt-1 text-xs text-gray-500">Deadline {dateTime(c.deadline_at)}</div>
              {c.status === "open" && (
                <Button
                  className="mt-3"
                  size="sm"
                  loading={fulfill.isPending && fulfill.variables === c.id}
                  onClick={() => fulfill.mutate(c.id)}
                >
                  Fulfill
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </Section>
  );
}

export default function MarketPage() {
  return (
    <RequireAuth>
      <MarketInner />
    </RequireAuth>
  );
}
