import { Bar } from "@/components/ui/Bar";
import type { Plant } from "@/lib/types";

export function StatBars({ plant }: { plant: Plant }) {
  return (
    <div className="grid grid-cols-1 gap-2">
      <Bar label="Health" value={plant.health} danger={plant.health < 30} />
      <Bar label="Water" value={plant.water_level} />
      <Bar label="Nutrients" value={plant.nutrient_level} />
      {plant.pest_level > 0 && (
        <Bar label="Pests" value={plant.pest_level} invert color="bg-lime-500" />
      )}
      {plant.disease_level > 0 && (
        <Bar label="Disease" value={plant.disease_level} invert color="bg-slate-400" />
      )}
    </div>
  );
}
