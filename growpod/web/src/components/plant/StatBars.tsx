"use client";

import { Bar } from "@/components/ui/Bar";
import type { Plant } from "@/lib/types";
import { useRef, useEffect, useState } from "react";

export function StatBars({ plant }: { plant: Plant }) {
  const prevRef = useRef({ health: plant.health, water: plant.water_level, nutrients: plant.nutrient_level });
  const [changed, setChanged] = useState({ health: false, water: false, nutrients: false });

  useEffect(() => {
    const prev = prevRef.current;
    const newChanged = {
      health: plant.health !== prev.health,
      water: plant.water_level !== prev.water,
      nutrients: plant.nutrient_level !== prev.nutrients,
    };
    setChanged(newChanged);
    prevRef.current = { health: plant.health, water: plant.water_level, nutrients: plant.nutrient_level };

    const timer = setTimeout(() => setChanged({ health: false, water: false, nutrients: false }), 500);
    return () => clearTimeout(timer);
  }, [plant.health, plant.water_level, plant.nutrient_level]);

  return (
    <div className="grid grid-cols-1 gap-2">
      <Bar label="Health" value={plant.health} danger={plant.health < 30} justChanged={changed.health} />
      <Bar label="Water" value={plant.water_level} justChanged={changed.water} />
      <Bar label="Nutrients" value={plant.nutrient_level} justChanged={changed.nutrients} />
      {plant.pest_level > 0 && (
        <Bar label="Pests" value={plant.pest_level} invert color="bg-lime-500" />
      )}
      {plant.disease_level > 0 && (
        <Bar label="Disease" value={plant.disease_level} invert color="bg-slate-400" />
      )}
    </div>
  );
}
