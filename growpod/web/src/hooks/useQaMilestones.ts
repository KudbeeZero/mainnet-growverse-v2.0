"use client";

// Frontend-only QA feedback. When the QA 10× boost is ON, watch the plant's
// real (server-owned) state between polls and fire toasts as it changes, so a
// tester sees progression immediately instead of staring at a static card.
// Derives ENTIRELY from existing PlantState — no backend changes, no fake data,
// no production economy effects. Off unless the QA boost is active.

import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui/Toast";
import { useDevSpeedStore } from "@/lib/devSpeedStore";
import { titleCase } from "@/lib/format";
import type { PlantState } from "@/lib/types";

export function useQaMilestones(plant: PlantState | undefined) {
  const qaActive = useDevSpeedStore((s) => s.devSpeed);
  const toast = useToast();
  const prev = useRef<PlantState | null>(null);

  useEffect(() => {
    if (!plant) return;
    const p = prev.current;
    prev.current = plant;
    // Only nudge in QA mode, and only once we have a baseline for this plant.
    if (!qaActive || !p || p.id !== plant.id) return;

    if (p.growth_stage !== plant.growth_stage) {
      toast.success(`🌿 New stage unlocked: ${titleCase(plant.growth_stage)}`);
      if (plant.growth_stage === "harvest") toast.success("✅ Ready for harvest");
    }
    if (plant.water_level - p.water_level >= 10) toast.push("💧 Water level changed", "info");
    if (plant.nutrient_level - p.nutrient_level >= 10) toast.push("🌱 Nutrients absorbed", "info");
    if (p.health - plant.health >= 8) toast.push("⚠️ Environment needs attention", "error");

    const before = new Set(p.condition_flags.map((c) => c.condition));
    const fresh = plant.condition_flags.find(
      (c) => c.condition !== "healthy" && !before.has(c.condition),
    );
    if (fresh) toast.push(`⚠️ ${titleCase(fresh.condition)} detected`, "info");
  }, [plant, qaActive, toast]);
}
