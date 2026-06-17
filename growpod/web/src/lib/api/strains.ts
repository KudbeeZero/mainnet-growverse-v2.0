import { apiFetch } from "./client";
import type {
  Strain,
  LineageType,
  Rarity,
  StrainKnowledge,
  Provenance,
  Lineage,
} from "@/lib/types";

export interface StrainFilters {
  catalog_only?: boolean;
  q?: string;
  rarity?: Rarity;
  lineage_type?: LineageType;
  min_thc?: number;
  max_thc?: number;
  min_indica?: number;
  max_indica?: number;
}

export const strains = {
  list: (filters: StrainFilters = {}) =>
    apiFetch<Strain[]>("/strains", { query: filters as Record<string, string | number | boolean | undefined> }),

  get: (strainId: string) => apiFetch<Strain>(`/strains/${strainId}`),

  // Scientist-grade encyclopedia (lineage, terpenes, cannabinoids, grow params).
  knowledge: (strainId: string) =>
    apiFetch<StrainKnowledge>(`/strains/${strainId}/knowledge`),

  // Provably-fair: re-derive the bred genome from its public seed and compare.
  provenance: (strainId: string) =>
    apiFetch<Provenance>(`/strains/${strainId}/provenance`),

  // Verifiable pedigree back to base-catalog roots (the GenBank family tree).
  lineage: (strainId: string) => apiFetch<Lineage>(`/strains/${strainId}/lineage`),

  favorites: (playerId: string) =>
    apiFetch<Strain[]>(`/players/${playerId}/favorites`, { auth: true }),

  addFavorite: (playerId: string, strainId: string) =>
    apiFetch<{ favorited: boolean }>(
      `/players/${playerId}/strains/${strainId}/favorite`,
      { method: "POST" },
    ),

  removeFavorite: (playerId: string, strainId: string) =>
    apiFetch<{ favorited: boolean }>(
      `/players/${playerId}/strains/${strainId}/favorite`,
      { method: "DELETE" },
    ),

  // Stabilization RNG seed is server-generated (anti seed-shopping).
  stabilize: (playerId: string, strainId: string) =>
    apiFetch<Strain>(`/players/${playerId}/strains/${strainId}/stabilize`, {
      method: "POST",
    }),

  mint: (playerId: string, strainId: string) =>
    apiFetch<Strain>(`/players/${playerId}/strains/${strainId}/mint`, { method: "POST" }),
};
