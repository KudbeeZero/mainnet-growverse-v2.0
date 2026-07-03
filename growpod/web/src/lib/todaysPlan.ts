/**
 * Today's Plan — the prioritized care checklist for the Grow Chamber's side
 * panel (mockup: "TODAY'S PLAN"). Pure resolver: plant state + care
 * availability in, ranked entries out. Complements `nextPlantAction` (the
 * single top CTA) with the full "what's worth doing" list so the player always
 * knows what to do next without leaving the chamber.
 */
import type { Plant } from "@/lib/types";
import type { CareAvailability } from "@/lib/careAvailability";

export type PlanUrgency = "now" | "soon" | "upcoming";

export interface PlanEntry {
  /** Care kind for actionable rows (drives the Do-Now button); null = informational. */
  kind: "water" | "feed" | "treatPests" | "treatDisease" | "prune" | "train" | "harvest" | null;
  icon: string;
  title: string;
  why: string;
  urgency: PlanUrgency;
}

const RANK: Record<PlanUrgency, number> = { now: 0, soon: 1, upcoming: 2 };

export function buildTodaysPlan(
  plant: Plant,
  avail: Record<"water" | "feed" | "treatPests" | "treatDisease" | "prune" | "train", CareAvailability>,
  hoursToHarvest?: number | null,
): PlanEntry[] {
  const out: PlanEntry[] = [];
  if (!plant.is_alive || plant.harvested) return out;

  if (plant.growth_stage === "harvest") {
    out.push({ kind: "harvest", icon: "✂️", title: "Harvest now", why: "Buds are ripe and ready to cut", urgency: "now" });
  }
  if (plant.pest_level > 0 && avail.treatPests.available) {
    out.push({ kind: "treatPests", icon: "🐞", title: "Treat pests", why: "Active pest pressure", urgency: "now" });
  }
  if (plant.disease_level > 0 && avail.treatDisease.available) {
    out.push({ kind: "treatDisease", icon: "🧫", title: "Treat disease", why: "Active disease pressure", urgency: "now" });
  }
  if (plant.water_level < 60) {
    out.push({ kind: "water", icon: "💧", title: "Water", why: "Water level low", urgency: plant.water_level < 35 ? "now" : "soon" });
  }
  if (plant.nutrient_level < 60) {
    out.push({ kind: "feed", icon: "🧪", title: "Feed", why: "Nutrients low", urgency: plant.nutrient_level < 35 ? "now" : "soon" });
  }
  if (avail.prune.available) {
    out.push({ kind: "prune", icon: "✂️", title: "Prune", why: "Improve airflow this stage", urgency: "soon" });
  }
  if (avail.train.available) {
    out.push({ kind: "train", icon: "🪢", title: "Train", why: "Shape the plant, ease stress", urgency: "soon" });
  }
  if (plant.growth_stage !== "harvest" && hoursToHarvest != null && hoursToHarvest > 0) {
    const d = Math.floor(hoursToHarvest / 24);
    const h = Math.round(hoursToHarvest % 24);
    out.push({
      kind: null,
      icon: "🌾",
      title: "Harvest review",
      why: `Ready in ${d > 0 ? `${d}d ` : ""}${h}h`,
      urgency: "upcoming",
    });
  }

  out.sort((a, b) => RANK[a.urgency] - RANK[b.urgency]);
  return out.slice(0, 5);
}

export const URGENCY_LABEL: Record<PlanUrgency, string> = {
  now: "Do Now",
  soon: "Soon",
  upcoming: "Upcoming",
};
