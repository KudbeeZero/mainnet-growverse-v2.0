"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useToast } from "@/components/ui/Toast";
import { useIdStore } from "@/lib/localStore";
import { queryKeys } from "@/lib/queryKeys";
import { useSeeds, useStrainMap } from "@/hooks/queries";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import type { Plant } from "@/lib/types";

export function PlantSeedForm({ podId }: { podId: string }) {
  const { playerId } = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const addPlant = useIdStore((s) => s.addPlant);
  const { data: seeds } = useSeeds();
  const { map } = useStrainMap();
  const [seedId, setSeedId] = useState("");

  const available = (seeds ?? []).filter((s) => s.quantity > 0);
  const effectiveSeed = seedId || available[0]?.id || "";

  const mutation = useMutation<Plant, ApiError>({
    mutationFn: () => api.plants.plant(playerId!, effectiveSeed, podId),
    onSuccess: (plant) => {
      addPlant(playerId!, plant.id);
      qc.invalidateQueries({ queryKey: queryKeys.plants(playerId!) });
      qc.invalidateQueries({ queryKey: queryKeys.seeds(playerId!) });
      toast.success("Seed planted");
    },
    onError: (e) => toast.error(e.message),
  });

  if (!available.length) {
    return (
      <p className="text-xs text-gray-500">
        No seeds in inventory — buy one in the Strain Lab first.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Select
        data-onboarding="seed-select"
        value={effectiveSeed}
        onChange={(e) => setSeedId(e.target.value)}
        className="max-w-xs"
      >
        {available.map((s) => (
          <option key={s.id} value={s.id}>
            {map.get(s.strain_id)?.name ?? "Strain"} ×{s.quantity}
          </option>
        ))}
      </Select>
      <Button
        data-onboarding="plant-here"
        size="sm"
        loading={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        🌱 Plant here
      </Button>
    </div>
  );
}
