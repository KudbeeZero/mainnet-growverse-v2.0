"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  const { playerId, isAuthed } = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const addPlant = useIdStore((s) => s.addPlant);
  const { data: seeds } = useSeeds();
  const { map } = useStrainMap();
  const [seedId, setSeedId] = useState("");
  const [soilKey, setSoilKey] = useState("");

  const { data: gear } = useQuery({
    queryKey: queryKeys.gear(playerId ?? ""),
    queryFn: () => api.store.gear(playerId!),
    enabled: isAuthed,
  });
  const ownedSoils = (gear ?? []).filter((g) => g.category === "soil" && g.owned > 0);

  const available = (seeds ?? []).filter((s) => s.quantity > 0);
  const effectiveSeed = seedId || available[0]?.id || "";

  const mutation = useMutation<Plant, ApiError>({
    mutationFn: () => api.plants.plant(playerId!, effectiveSeed, podId, soilKey || undefined),
    onSuccess: (plant) => {
      addPlant(playerId!, plant.id);
      qc.invalidateQueries({ queryKey: queryKeys.plants(playerId!) });
      qc.invalidateQueries({ queryKey: queryKeys.seeds(playerId!) });
      // Refresh the pod so its "x/N plants" capacity badge updates at once.
      qc.invalidateQueries({ queryKey: queryKeys.pods(playerId!) });
      if (soilKey) qc.invalidateQueries({ queryKey: queryKeys.gear(playerId!) });
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
      {ownedSoils.length > 0 && (
        <Select
          value={soilKey}
          onChange={(e) => setSoilKey(e.target.value)}
          className="max-w-[11rem]"
          title="Growing medium — affects nutrient/water decay for this plant's whole life"
        >
          <option value="">🪴 No soil chosen</option>
          {ownedSoils.map((s) => (
            <option key={s.key} value={s.key}>
              {s.name} ×{s.owned}
            </option>
          ))}
        </Select>
      )}
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
