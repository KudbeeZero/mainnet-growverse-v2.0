"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useSeeds, useStrainMap } from "@/hooks/queries";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";
import { queryKeys } from "@/lib/queryKeys";
import type { Listing } from "@/lib/types";

export function CreateListingForm() {
  const { playerId } = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const { data: seeds } = useSeeds();
  const { map } = useStrainMap();

  const [seedId, setSeedId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(50);
  const [isAuction, setIsAuction] = useState(false);
  const [duration, setDuration] = useState(24);

  const available = (seeds ?? []).filter((s) => s.quantity > 0);
  const effectiveSeed = seedId || available[0]?.id || "";

  const create = useMutation<Listing, ApiError>({
    mutationFn: () =>
      isAuction
        ? api.market.createAuction(playerId!, effectiveSeed, quantity, price, duration)
        : api.market.createListing(playerId!, effectiveSeed, quantity, price),
    onSuccess: () => {
      toast.success(isAuction ? "Auction created" : "Listing created");
      qc.invalidateQueries({ queryKey: queryKeys.market() });
      qc.invalidateQueries({ queryKey: queryKeys.seeds(playerId!) });
      qc.invalidateQueries({ queryKey: queryKeys.wallet(playerId!) });
    },
    onError: (e) => toast.error(e.message),
  });

  if (!available.length) {
    return <p className="text-sm text-gray-500">No seeds to sell — buy or breed some first.</p>;
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Seed">
          <Select value={effectiveSeed} onChange={(e) => setSeedId(e.target.value)}>
            {available.map((s) => (
              <option key={s.id} value={s.id}>
                {map.get(s.strain_id)?.name ?? "Strain"} ×{s.quantity}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Quantity">
          <TextInput
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
        </Field>
        <Field label={isAuction ? "Min bid (GC)" : "Unit price (GC)"}>
          <TextInput
            type="number"
            min={1}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
          />
        </Field>
        {isAuction && (
          <Field label="Duration (hours)">
            <TextInput
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </Field>
        )}
      </div>
      <label className="flex items-center gap-2 text-xs text-gray-400">
        <input
          type="checkbox"
          checked={isAuction}
          onChange={(e) => setIsAuction(e.target.checked)}
        />
        Sell as auction
      </label>
      <Button type="submit" loading={create.isPending}>
        {isAuction ? "Create auction" : "Create listing"}
      </Button>
    </form>
  );
}
