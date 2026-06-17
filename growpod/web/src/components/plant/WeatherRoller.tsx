"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { titleCase } from "@/lib/format";

export function WeatherRoller({ podId }: { podId: string }) {
  const { playerId } = useSession();
  const toast = useToast();
  const qc = useQueryClient();

  // Weather is rolled server-side at random — players can't choose the event.
  const roll = useMutation<Record<string, unknown>, ApiError, void>({
    mutationFn: () => api.pods.rollWeather(playerId!, podId),
    onSuccess: (res) => {
      const ev = (res["event"] ?? res["weather"] ?? "weather") as string;
      toast.push(`Weather: ${titleCase(String(ev))}`, "info");
      qc.invalidateQueries({ queryKey: ["plant"] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="secondary"
        loading={roll.isPending}
        onClick={() => roll.mutate()}
      >
        🎲 Random Weather
      </Button>
    </div>
  );
}
