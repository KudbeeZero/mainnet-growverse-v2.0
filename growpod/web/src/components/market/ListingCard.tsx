"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";
import { queryKeys } from "@/lib/queryKeys";
import { grow, titleCase, dateTime } from "@/lib/format";
import type { Listing } from "@/lib/types";

export function ListingCard({ listing }: { listing: Listing }) {
  const { playerId } = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const [bid, setBid] = useState("");

  const mine = listing.seller_id === playerId;

  function refresh() {
    qc.invalidateQueries({ queryKey: queryKeys.market() });
    if (playerId) {
      qc.invalidateQueries({ queryKey: queryKeys.wallet(playerId) });
      qc.invalidateQueries({ queryKey: queryKeys.seeds(playerId) });
    }
  }

  const buy = useMutation<Listing, ApiError>({
    mutationFn: () => api.market.buy(playerId!, listing.id),
    onSuccess: () => {
      toast.success("Purchased");
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const placeBid = useMutation<Listing, ApiError>({
    mutationFn: () => api.market.bid(playerId!, listing.id, Number(bid)),
    onSuccess: () => {
      toast.success("Bid placed");
      setBid("");
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const settle = useMutation<Listing, ApiError>({
    mutationFn: () => api.market.settle(playerId!, listing.id),
    onSuccess: () => {
      toast.success("Auction settled");
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const minNext = (listing.highest_bid ?? listing.min_bid ?? 0) + 1;

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-medium text-gray-100">
          {titleCase(listing.item_type)} ×{listing.quantity}
        </span>
        <div className="flex gap-1.5">
          {listing.is_auction && (
            <Badge className="border-amber-700 bg-amber-900/40 text-amber-200">Auction</Badge>
          )}
          {mine && <Badge className="border-ink-600 bg-ink-700 text-gray-400">Yours</Badge>}
          <Badge className="border-ink-600 bg-ink-700 text-gray-300">{titleCase(listing.status)}</Badge>
        </div>
      </div>

      {listing.is_auction ? (
        <div className="text-sm text-gray-300">
          <div>Min bid: {grow(listing.min_bid)}</div>
          <div>
            Highest: {grow(listing.highest_bid)}{" "}
            {listing.highest_bidder_id && (
              <span className="text-xs text-gray-500">
                ({listing.highest_bidder_id === playerId ? "you" : "another grower"})
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500">Ends {dateTime(listing.expires_at)}</div>
        </div>
      ) : (
        <div className="text-sm text-gray-300">Price: {grow(listing.unit_price)} each</div>
      )}

      {listing.status === "active" && (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {listing.is_auction ? (
            <>
              {!mine && (
                <>
                  <TextInput
                    type="number"
                    value={bid}
                    onChange={(e) => setBid(e.target.value)}
                    placeholder={`≥ ${minNext}`}
                    className="w-28"
                  />
                  <Button
                    size="sm"
                    loading={placeBid.isPending}
                    disabled={!bid || Number(bid) < minNext}
                    onClick={() => placeBid.mutate()}
                  >
                    Bid
                  </Button>
                </>
              )}
              <Button size="sm" variant="secondary" loading={settle.isPending} onClick={() => settle.mutate()}>
                Settle
              </Button>
            </>
          ) : (
            !mine && (
              <Button size="sm" loading={buy.isPending} onClick={() => buy.mutate()}>
                Buy {grow(listing.unit_price * listing.quantity)}
              </Button>
            )
          )}
        </div>
      )}
    </Card>
  );
}
