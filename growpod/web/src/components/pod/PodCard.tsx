"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PlantCard } from "@/components/plant/PlantCard";
import { titleCase } from "@/lib/format";
import type { Pod } from "@/lib/types";

const PlantSeedForm = dynamic(
  () => import("@/components/plant/PlantSeedForm").then((m) => m.PlantSeedForm),
  { loading: () => null },
);
const EnvironmentForm = dynamic(
  () => import("@/components/plant/EnvironmentForm").then((m) => m.EnvironmentForm),
  { loading: () => null },
);
const WeatherRoller = dynamic(
  () => import("@/components/plant/WeatherRoller").then((m) => m.WeatherRoller),
  { loading: () => null },
);

export function PodCard({
  pod,
  plantIds,
}: {
  pod: Pod;
  plantIds: string[];
}) {
  const [showEnv, setShowEnv] = useState(false);

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{pod.name}</h2>
          <Badge className="border-ink-600 bg-ink-700 text-gray-300">
            {titleCase(pod.tier)}
          </Badge>
          <span className="text-xs text-gray-400">
            {plantIds.length}/{pod.capacity} plants
          </span>
          {pod.auto_water && (
            <Badge className="border-sky-700 bg-sky-900/40 text-sky-300">auto-water</Badge>
          )}
          {pod.auto_feed && (
            <Badge className="border-emerald-700 bg-emerald-900/40 text-emerald-300">
              auto-feed
            </Badge>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={() => setShowEnv((s) => !s)}>
          {showEnv ? "Hide controls" : "Environment & Weather"}
        </Button>
      </div>

      {showEnv && (
        <div className="mb-4 space-y-3 rounded-lg border border-ink-700 bg-ink-900/50 p-3">
          <EnvironmentForm podId={pod.id} />
          <WeatherRoller podId={pod.id} />
        </div>
      )}

      <div className="mb-3">
        <PlantSeedForm podId={pod.id} />
      </div>

      {plantIds.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {plantIds.map((id) => (
            <PlantCard key={id} playerId={pod.player_id} plantId={id} pod={pod} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">Empty pod — plant a seed to get growing.</p>
      )}
    </Card>
  );
}
