"use client";

// "Use item" surface — the missing half of the consumables loop. The store
// sells consumables (ConsumableInventory) but nothing let a player USE the ones
// they own. This lists the player's OWNED consumables and applies one to the
// plant (POST .../apply → SimulationService.apply_consumable), which spends the
// stack and buffs the plant's simulated levels. No currency moves (it was bought
// already), so this is care, not commerce.

import { useConsumables, useApplyConsumable } from "@/hooks/useConsumables";
import { ownedConsumableOptions } from "@/lib/consumableAction";
import { Button } from "@/components/ui/Button";
import type { Plant } from "@/lib/types";

export function ConsumablesPanel({ plant }: { plant: Plant }) {
  const { data, isLoading } = useConsumables();
  const apply = useApplyConsumable(plant.id);
  const options = ownedConsumableOptions(data, plant);

  // Nothing owned (or still loading the first time) → render nothing, so the
  // Care area stays clean for players who haven't bought any consumables.
  if (isLoading || options.length === 0) return null;

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-gray-300">Items</h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((it) => {
          const pending = apply.isPending && apply.variables?.itemKey === it.key;
          const disabled = !it.applicable || pending;
          return (
            <div
              key={it.key}
              className="flex items-center justify-between gap-3 rounded-lg border border-ink-700 bg-ink-900/60 p-2.5"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium text-gray-100">{it.name}</span>
                  <span className="shrink-0 rounded bg-ink-700 px-1.5 py-0.5 text-[10px] font-mono text-gray-400">
                    ×{it.owned}
                  </span>
                </div>
                <p className="truncate text-[11px] text-gray-500">
                  {it.applicable ? it.description : it.reason}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => apply.mutate({ itemKey: it.key, name: it.name })}
                disabled={disabled}
                title={it.applicable ? `Use ${it.name}` : it.reason}
              >
                {pending ? "Using…" : "Use"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
