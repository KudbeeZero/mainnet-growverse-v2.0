"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useToast } from "@/components/ui/Toast";
import { useIdStore } from "@/lib/localStore";
import { queryKeys } from "@/lib/queryKeys";
import { Button } from "@/components/ui/Button";
import { Field, TextInput, Select } from "@/components/ui/Field";
import type { Pod, PodTier } from "@/lib/types";

const TIER_PRICE: Record<PodTier, number> = { basic: 100, standard: 400, pro: 1200 };

export function CreatePodForm({ onCreated }: { onCreated?: () => void }) {
  const { playerId } = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const addPod = useIdStore((s) => s.addPod);

  const [name, setName] = useState("My Tent");
  const [tier, setTier] = useState<PodTier>("basic");
  const [capacity, setCapacity] = useState(4);

  const mutation = useMutation<Pod, ApiError>({
    mutationFn: () => api.pods.create(playerId!, name, { tier, capacity }),
    onSuccess: (pod) => {
      addPod(playerId!, pod.id);
      qc.invalidateQueries({ queryKey: queryKeys.pods(playerId!) });
      qc.invalidateQueries({ queryKey: queryKeys.wallet(playerId!) });
      toast.success(`Created pod "${pod.name}"`);
      onCreated?.();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <Field label="Pod name">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tier" hint={`Cost ${TIER_PRICE[tier]} GC`}>
          <Select value={tier} onChange={(e) => setTier(e.target.value as PodTier)}>
            <option value="basic">Basic</option>
            <option value="standard">Standard</option>
            <option value="pro">Pro</option>
          </Select>
        </Field>
        <Field label="Capacity" hint="Dashboard shows up to 4 plants per pod today">
          <TextInput
            type="number"
            min={1}
            max={4}
            value={capacity}
            onChange={(e) =>
              setCapacity(Math.min(4, Math.max(1, Number(e.target.value) || 1)))
            }
          />
        </Field>
      </div>
      <Button type="submit" loading={mutation.isPending}>
        Create Pod
      </Button>
    </form>
  );
}
