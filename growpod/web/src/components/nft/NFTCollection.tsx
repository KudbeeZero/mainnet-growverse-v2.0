"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LoadingBlock } from "@/components/ui/Spinner";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { queryKeys } from "@/lib/queryKeys";
import type { NFTAsset } from "@/lib/types";

export function NFTCollection() {
  const { playerId } = useSession();
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);

  // Fetch collection
  const collection = useQuery({
    queryKey: queryKeys.nftCollection(playerId ?? ""),
    queryFn: () => (playerId ? api.nft.getCollection(playerId) : Promise.resolve([])),
    enabled: !!playerId,
  });

  if (collection.isLoading) {
    return <LoadingBlock label="Loading NFTs…" />;
  }

  const assets = (collection.data as NFTAsset[]) ?? [];

  if (assets.length === 0) {
    return (
      <Card>
        <div className="text-center py-8">
          <div className="text-5xl mb-3">🎲</div>
          <p className="text-sm text-gray-400">
            No NFTs yet. Harvest and mint your first plant to get started.
          </p>
        </div>
      </Card>
    );
  }

  const statusColors = {
    minted: "bg-grow-900/30 border-grow-700/60",
    listed: "bg-blue-900/30 border-blue-700/60",
    staking: "bg-purple-900/30 border-purple-700/60",
    traded: "bg-gray-900/30 border-gray-700/60",
  };

  const statusIcons = {
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
            onClick={() => setSelectedAsset(asset.asset_id.toString())}
            className={`cursor-pointer rounded-lg border-2 p-3 transition-all ${
              statusColors[asset.status as keyof typeof statusColors]
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
              <div className="text-2xl">{statusIcons[asset.status as keyof typeof statusIcons]}</div>
            </div>

            {/* Status badge */}
            <Badge className="mb-2">
              {asset.status === "minted" && "Ready"}
              {asset.status === "listed" && "For Sale"}
              {asset.status === "staking" && "Curing"}
              {asset.status === "traded" && "Owned"}
            </Badge>

            {/* Metadata traits */}
            {asset.metadata?.attributes && (
              <div className="space-y-1 mt-2 text-[10px] text-gray-400">
                {asset.metadata.attributes.slice(0, 2).map((attr: any, i: number) => (
                  <div key={i} className="flex justify-between">
                    <span>{attr.trait_type}:</span>
                    <span className="font-mono text-gray-300">{attr.value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Minted at */}
            {asset.minted_at && (
              <div className="mt-2 text-[10px] text-gray-600">
                {new Date(asset.minted_at).toLocaleDateString()}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Detail panel */}
      {selectedAsset && (
        <Card className="border-grow-700/40">
          <CardHeader title="NFT Details" />
          {assets
            .filter((a) => a.asset_id.toString() === selectedAsset)
            .map((asset) => (
              <div key={asset.asset_id} className="space-y-3">
                {/* Full metadata */}
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
                          {asset.metadata.attributes.map((attr: any, i: number) => (
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

                {/* Action buttons */}
                <div className="flex gap-2 pt-2">
                  {asset.status === "minted" && (
                    <>
                      <Button size="sm" className="flex-1">
                        🏷️ List for sale
                      </Button>
                      <Button size="sm" variant="secondary" className="flex-1">
                        ⏳ Stake for curing
                      </Button>
                    </>
                  )}
                  {asset.status === "listed" && (
                    <Button size="sm" variant="ghost" className="flex-1">
                      📋 Delist
                    </Button>
                  )}
                  {asset.status === "staking" && (
                    <div className="text-xs text-gray-400">
                      Locked for curing — check stakes tab for progress
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
