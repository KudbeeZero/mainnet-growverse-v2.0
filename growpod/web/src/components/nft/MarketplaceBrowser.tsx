"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LoadingBlock } from "@/components/ui/Spinner";
import { useApiMutation } from "@/hooks/useApiMutation";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { queryKeys } from "@/lib/queryKeys";
import type { NFTListing } from "@/lib/types";

export function MarketplaceBrowser() {
  const { playerId } = useSession();
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState<"created_at" | "price_ualgos">("created_at");
  const [selectedListing, setSelectedListing] = useState<NFTListing | null>(null);

  const limit = 12;

  const listings = useQuery({
    queryKey: queryKeys.nftMarketListings(page * limit, limit, sortBy),
    queryFn: () =>
      api.nftMarket.getListings({
        limit,
        offset: page * limit,
        sort: sortBy,
      }),
  });

  const buy = useApiMutation((listingId: string) => api.nftMarket.executeTrade(playerId!, listingId), {
    invalidate: [queryKeys.nftMarketListings(page * limit, limit, sortBy), queryKeys.nftCollection(playerId ?? "")],
    successMessage: "Trade recorded — pending on-chain confirmation",
    onSuccess: () => setSelectedListing(null),
  });

  const isLoading = listings.isLoading;
  const data = listings.data;
  const items = data?.listings ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={sortBy === "created_at" ? "primary" : "secondary"}
            onClick={() => setSortBy("created_at")}
          >
            Recent
          </Button>
          <Button
            size="sm"
            variant={sortBy === "price_ualgos" ? "primary" : "secondary"}
            onClick={() => setSortBy("price_ualgos")}
          >
            Price ↓
          </Button>
        </div>
        <div className="text-xs text-gray-500">{total} listings</div>
      </div>

      {isLoading ? (
        <LoadingBlock label="Loading marketplace…" />
      ) : items.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <div className="text-5xl mb-3">🎪</div>
            <p className="text-sm text-gray-400">
              No listings yet. Be the first to list an NFT!
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* Listings grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((listing) => (
              <div
                key={listing.listing_id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedListing(listing)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedListing(listing);
                  }
                }}
                className={`cursor-pointer rounded-lg border-2 border-ink-700 bg-ink-900/40 p-3 transition-all hover:border-grow-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grow-400 ${
                  selectedListing?.listing_id === listing.listing_id
                    ? "ring-2 ring-offset-2 ring-grow-500"
                    : ""
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="text-xs text-gray-500">ASA #{listing.asset_id}</div>
                    <div className="text-lg font-bold text-grow-300 mt-1">
                      {parseFloat(listing.price_ualgos).toLocaleString()} µA
                    </div>
                  </div>
                  <Badge className="border-ink-600 bg-ink-700/40">
                    {listing.seller_address.slice(0, 10)}…
                  </Badge>
                </div>

                <div className="text-[10px] text-gray-600">
                  Listed {new Date(listing.created_at).toLocaleDateString()}
                  {listing.expires_at && (
                    <div>Expires {new Date(listing.expires_at).toLocaleDateString()}</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Detail panel */}
          {selectedListing && (
            <Card className="border-grow-700/40">
              <CardHeader title="Listing Details" />
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-xs text-gray-500">ASA ID</div>
                    <div className="font-mono text-gray-200">#{selectedListing.asset_id}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Price</div>
                    <div className="font-mono text-grow-300">
                      {parseFloat(selectedListing.price_ualgos).toLocaleString()} µA
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Seller</div>
                    <div className="font-mono text-gray-300">{selectedListing.seller_address}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Listed</div>
                    <div className="text-gray-300">
                      {new Date(selectedListing.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => buy.mutate(selectedListing.listing_id)}
                  className="w-full"
                  size="md"
                  loading={buy.isPending}
                  disabled={!playerId}
                >
                  🛒 Buy Now
                </Button>
                <p className="text-[10px] text-gray-500">
                  TestNet MVP: this records the trade and transfers ownership in the
                  database. Wallet-signed on-chain settlement isn&apos;t wired up yet.
                </p>
              </div>
            </Card>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
            >
              ← Previous
            </Button>
            <div className="text-xs text-gray-400">
              Page {page + 1} of {totalPages}
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
            >
              Next →
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
