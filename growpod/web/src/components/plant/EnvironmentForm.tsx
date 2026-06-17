"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, type Environment } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";

const DEFAULTS: Environment = {
  temperature: 24,
  humidity: 55,
  co2_level: 800,
  light_intensity: 600,
  ph_level: 6.3,
};

const FIELDS: { key: keyof Environment; label: string; step: number }[] = [
  { key: "temperature", label: "Temp (°C)", step: 0.5 },
  { key: "humidity", label: "Humidity (%)", step: 1 },
  { key: "co2_level", label: "CO₂ (ppm)", step: 10 },
  { key: "light_intensity", label: "Light", step: 10 },
  { key: "ph_level", label: "pH", step: 0.1 },
];

export function EnvironmentForm({ podId }: { podId: string }) {
  const { playerId } = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const [env, setEnv] = useState<Environment>(DEFAULTS);

  const mutation = useMutation<unknown, ApiError, Environment>({
    mutationFn: (e) => api.pods.setEnvironment(playerId!, podId, e),
    onSuccess: () => {
      toast.success("Environment updated");
      qc.invalidateQueries({ queryKey: ["pods"] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate(env);
      }}
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {FIELDS.map((f) => (
          <Field key={f.key} label={f.label}>
            <TextInput
              type="number"
              step={f.step}
              value={env[f.key]}
              onChange={(e) =>
                setEnv((s) => ({ ...s, [f.key]: Number(e.target.value) }))
              }
            />
          </Field>
        ))}
      </div>
      <Button type="submit" size="sm" loading={mutation.isPending}>
        Apply Environment
      </Button>
      <p className="text-[11px] text-gray-500">
        High humidity (&gt;64%) breeds mildew; extreme values stress the plant.
      </p>
    </form>
  );
}
