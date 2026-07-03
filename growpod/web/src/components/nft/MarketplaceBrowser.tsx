"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LoadingBlock } from "@/components/ui/Spinner";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

interface NFTListing {
  listing_id: string;
  asset_id: number;
  seller: string;
  price_ualgos: string;
  created_at: string;
  expires_at: string | null;
}

export function MarketplaceBrowser() {
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState<"created_at" | "price_ualgos">("created_at");
  const [selectedListing, setSelectedListing] = useState<NFTListing | null>(null);

  const limit = 12;

  // Fetch listings
  const listings = useQuery({
    queryKey: queryKeys.marketListings(page * limit, limit, sortBy),
    queryFn: () =>
      api.nftMarket.getListings({
        limit,
        offset: page * limit,
        sort: sortBy,
      }),
  });

  const handleBuy = async (listingId: string) => {
    // TODO: trigger buy flow with Pera wallet signature
    console.log("Buy listing:", listingId);
  };

  const isLoading = listings.isLoading;
  const data = listings.data as any;
  const items = data?.listings ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={sortBy === "created_at" ? "default" : "secondary"}
            onClick={() => setSortBy("created_at")}
          >
            Recent
          </Button>
          <Button
            size="sm"
            variant={sortBy === "price_ualgos" ? "default" : "secondary"}
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
            {items.map((listing: NFTListing) => (
              <div
                key={listing.listing_id}
                onClick={() => setSelectedListing(listing)}
                className={`cursor-pointer rounded-lg border-2 border-ink-700 bg-ink-900/40 p-3 transition-all hover:border-grow-600 ${
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
                  <Badge variant="outline">{listing.seller.slice(0, 10)}…</Badge>
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
                    <div className="font-mono text-gray-300">{selectedListing.seller}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Listed</div>
                    <div className="text-gray-300">
                      {new Date(selectedListing.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* Buy button */}
                <Button
                  onClick={() => handleBuy(selectedListing.listing_id)}
                  className="w-full"
                  size="lg"
                >
                  🛒 Buy Now
                </Button>

                {/* Price history stub */}
                <div className="border-t border-ink-700 pt-2">
                  <div className="text-xs font-bold uppercase text-gray-500 mb-2">
                    Price History
                  </div>
                  <div className="text-xs text-gray-400">
                    Loading price history…{" "}
                    <a href="#" className="text-grow-400 hover:underline">
                      view chart
                    </a>
                  </div>
                </div>
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
