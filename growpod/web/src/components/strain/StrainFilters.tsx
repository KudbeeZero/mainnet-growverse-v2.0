"use client";

import type { StrainFilters as Filters } from "@/lib/api";
import { TextInput, Select } from "@/components/ui/Field";
import type { Rarity, LineageType } from "@/lib/types";

export function StrainFilters({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
}) {
  function set<K extends keyof Filters>(key: K, value: Filters[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <TextInput
        placeholder="Search strains…"
        value={filters.q ?? ""}
        onChange={(e) => set("q", e.target.value || undefined)}
        className="max-w-xs"
      />
      <Select
        value={filters.rarity ?? ""}
        onChange={(e) => set("rarity", (e.target.value || undefined) as Rarity | undefined)}
        className="w-auto"
      >
        <option value="">All rarities</option>
        <option value="common">Common</option>
        <option value="uncommon">Uncommon</option>
        <option value="rare">Rare</option>
        <option value="epic">Epic</option>
        <option value="legendary">Legendary</option>
      </Select>
      <Select
        value={filters.lineage_type ?? ""}
        onChange={(e) =>
          set("lineage_type", (e.target.value || undefined) as LineageType | undefined)
        }
        className="w-auto"
      >
        <option value="">All lineages</option>
        <option value="landrace">Landrace</option>
        <option value="hybrid">Hybrid</option>
        <option value="bred">Bred</option>
      </Select>
      <label className="flex items-center gap-2 text-xs text-gray-400">
        <input
          type="checkbox"
          checked={filters.catalog_only ?? false}
          onChange={(e) => set("catalog_only", e.target.checked || undefined)}
        />
        Catalog only
      </label>
    </div>
  );
}
