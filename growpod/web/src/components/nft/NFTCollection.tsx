"use client";

import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LoadingBlock } from "@/components/ui/Spinner";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useNFTCollection, usePlayer } from "@/hooks/queries";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { queryKeys } from "@/lib/queryKeys";
import type { NFTAsset } from "@/lib/types";

export function NFTCollection() {
  const { playerId } = useSession();
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [listPriceDraft, setListPriceDraft] = useState<Record<number, string>>({});

  const collection = useNFTCollection();
  const player = usePlayer();
  const hasWallet = !!player.data?.algorand_address;

  const invalidate = [queryKeys.nftCollection(playerId ?? "")];

  const listMutation = useApiMutation(
    ({ assetId, priceUalgos }: { assetId: number; priceUalgos: string }) =>
      api.nftMarket.createListing(playerId!, assetId, priceUalgos),
    { invalidate, successMessage: "Listed on the NFT market" },
  );
  const delistMutation = useApiMutation(
    (listingId: string) => api.nftMarket.cancelListing(playerId!, listingId),
    { invalidate, successMessage: "Listing cancelled" },
  );
  const stakeMutation = useApiMutation(
    ({ assetId, harvestId }: { assetId: number; harvestId: string }) =>
      api.stakes.createLock(playerId!, assetId, harvestId),
    {
      invalidate: [...invalidate, queryKeys.stakingLocks(playerId ?? "")],
      successMessage: "Locked in the curing room",
    },
  );

  if (collection.isLoading) {
    return <LoadingBlock label="Loading NFTs…" />;
  }

  const assets = (collection.data as NFTAsset[]) ?? [];

  if (assets.length === 0) {
    return (
      <Card>
        <div className="text-center py-8">
          <div className="text-5xl mb-3">🎲</div>
          {hasWallet ? (
            <p className="text-sm text-gray-400">
              No NFTs yet. Harvest and mint your first plant to get started.
            </p>
          ) : (
            <p className="text-sm text-gray-400">
              Connect an Algorand wallet in your profile before minting — an NFT
              needs a wallet address to belong to.
            </p>
          )}
        </div>
      </Card>
    );
  }

  const statusColors: Record<string, string> = {
    minted: "bg-grow-900/30 border-grow-700/60",
    listed: "bg-blue-900/30 border-blue-700/60",
    staking: "bg-purple-900/30 border-purple-700/60",
    traded: "bg-gray-900/30 border-gray-700/60",
  };

  const statusIcons: Record<string, string> = {
    minted: "🪴",
    listed: "🏷️",
    staking: "⏳",
    traded: "✅",
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {assets.map((asset) => (
          <div
            key={asset.asset_id}
            role="button"
            tabIndex={0}
            onClick={() => setSelectedAsset(asset.asset_id.toString())}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSelectedAsset(asset.asset_id.toString());
              }
            }}
            className={`cursor-pointer rounded-lg border-2 p-3 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grow-400 ${
              statusColors[asset.status] ?? statusColors.minted
            } ${selectedAsset === asset.asset_id.toString() ? "ring-2 ring-offset-2 ring-grow-500" : ""}`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="text-sm font-bold text-gray-100">
                  {asset.metadata?.name ?? `#${asset.asset_id}`}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  ASA #{asset.asset_id}
                </div>
              </div>
              <div className="text-2xl">{statusIcons[asset.status] ?? "🪴"}</div>
            </div>

            <Badge className="mb-2">
              {asset.status === "minted" && "Ready"}
              {asset.status === "listed" && "For Sale"}
              {asset.status === "staking" && "Curing"}
              {asset.status === "traded" && "Owned"}
            </Badge>

            {asset.metadata?.attributes && (
              <div className="space-y-1 mt-2 text-[10px] text-gray-400">
                {asset.metadata.attributes.slice(0, 2).map((attr, i) => (
                  <div key={i} className="flex justify-between">
                    <span>{attr.trait_type}:</span>
                    <span className="font-mono text-gray-300">{attr.value}</span>
                  </div>
                ))}
              </div>
            )}

            {asset.minted_at && (
              <div className="mt-2 text-[10px] text-gray-600">
                {new Date(asset.minted_at).toLocaleDateString()}
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedAsset && (
        <Card className="border-grow-700/40">
          <CardHeader title="NFT Details" />
          {assets
            .filter((a) => a.asset_id.toString() === selectedAsset)
            .map((asset) => (
              <div key={asset.asset_id} className="space-y-3">
                {asset.metadata && (
                  <div className="space-y-2">
                    <div>
                      <div className="text-xs font-bold uppercase text-gray-400">Description</div>
                      <div className="text-sm text-gray-300 mt-1">{asset.metadata.description}</div>
                    </div>
                    {asset.metadata.attributes && (
                      <div>
                        <div className="text-xs font-bold uppercase text-gray-400 mb-1">
                          Attributes
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {asset.metadata.attributes.map((attr, i) => (
                            <div
                              key={i}
                              className="rounded border border-ink-700 bg-ink-900/50 p-2"
                            >
                              <div className="text-[10px] text-gray-500">{attr.trait_type}</div>
                              <div className="text-xs font-mono text-gray-200">{attr.value}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  {asset.status === "minted" && (
                    <>
                      <div className="flex flex-1 flex-col gap-1">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            step={1}
                            placeholder="1000000"
                            value={listPriceDraft[asset.asset_id] ?? ""}
                            onChange={(e) =>
                              setListPriceDraft((prev) => ({ ...prev, [asset.asset_id]: e.target.value }))
                            }
                            className="w-full min-h-[36px] rounded-md border border-ink-600 bg-ink-800 px-2 text-xs text-gray-100"
                            aria-label="List price in microAlgos"
                          />
                          <span className="text-[10px] text-gray-500">µA</span>
                        </div>
                        {(() => {
                          const raw = listPriceDraft[asset.asset_id];
                          const n = raw ? Number(raw) : NaN;
                          if (!raw || !Number.isFinite(n) || n <= 0) return null;
                          return (
                            <div className="text-[10px] text-gray-500">
                              ≈ {(n / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 6 })} ALGO
                            </div>
                          );
                        })()}
                        <Button
                          size="sm"
                          loading={listMutation.isPending}
                          disabled={(() => {
                            const raw = listPriceDraft[asset.asset_id];
                            const n = raw ? Number(raw) : NaN;
                            return !raw || !Number.isInteger(n) || n <= 0;
                          })()}
                          onClick={() => {
                            const price = listPriceDraft[asset.asset_id];
                            if (price) listMutation.mutate({ assetId: asset.asset_id, priceUalgos: price });
                          }}
                        >
                          🏷️ List for sale
                        </Button>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="flex-1"
                        loading={stakeMutation.isPending}
                        onClick={() =>
                          stakeMutation.mutate({ assetId: asset.asset_id, harvestId: asset.game_item_id })
                        }
                      >
                        ⏳ Stake for curing
                      </Button>
                    </>
                  )}
                  {asset.status === "listed" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1"
                      loading={delistMutation.isPending}
                      disabled={!asset.listing_id}
                      onClick={() => asset.listing_id && delistMutation.mutate(asset.listing_id)}
                    >
                      📋 Delist
                    </Button>
                  )}
                  {asset.status === "staking" && (
                    <div className="text-xs text-gray-400">
                      Locked for curing — check the Curing Room below for progress
                    </div>
                  )}
                </div>
              </div>
            ))}
        </Card>
      )}
    </div>
  );
}
