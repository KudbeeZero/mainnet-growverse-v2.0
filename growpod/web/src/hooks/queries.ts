"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { StrainFilters } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useSession } from "@/lib/session";
import type { LeaderboardKind } from "@/lib/types";

export function usePlayer() {
  const { playerId, isAuthed } = useSession();
  return useQuery({
    queryKey: queryKeys.player(playerId ?? ""),
    queryFn: () => api.players.get(playerId!),
    enabled: isAuthed,
  });
}

export function useWallet() {
  const { playerId, isAuthed } = useSession();
  return useQuery({
    queryKey: queryKeys.wallet(playerId ?? ""),
    queryFn: () => api.players.wallet(playerId!),
    enabled: isAuthed,
  });
}

export function useLevel() {
  const { playerId, isAuthed } = useSession();
  return useQuery({
    queryKey: queryKeys.level(playerId ?? ""),
    queryFn: () => api.players.level(playerId!),
    enabled: isAuthed,
  });
}

export function useLedger() {
  const { playerId, isAuthed } = useSession();
  return useQuery({
    queryKey: queryKeys.ledger(playerId ?? ""),
    queryFn: () => api.players.ledger(playerId!),
    enabled: isAuthed,
  });
}

export function useAchievements() {
  const { playerId, isAuthed } = useSession();
  return useQuery({
    queryKey: queryKeys.achievements(playerId ?? ""),
    queryFn: () => api.players.achievements(playerId!),
    enabled: isAuthed,
  });
}

export function useSeeds() {
  const { playerId, isAuthed } = useSession();
  return useQuery({
    queryKey: queryKeys.seeds(playerId ?? ""),
    queryFn: () => api.seeds.list(playerId!),
    enabled: isAuthed,
  });
}

export function usePods() {
  const { playerId, isAuthed } = useSession();
  return useQuery({
    queryKey: queryKeys.pods(playerId ?? ""),
    queryFn: () => api.pods.list(playerId!),
    enabled: isAuthed,
    // Pod sensor values feed the chamber bud phenotype (temp→purple, light→foxtails,
    // humidity→mold). Same-tab env edits invalidate ["pods"] already, but background
    // weather rolls / another tab won't — so refresh on a slow cadence and on focus
    // to keep the rendered plant honest without hammering the endpoint.
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function usePlantsList() {
  const { playerId, isAuthed } = useSession();
  return useQuery({
    queryKey: queryKeys.plants(playerId ?? ""),
    queryFn: () => api.plants.list(playerId!),
    enabled: isAuthed,
  });
}

export function useStrains(filters: StrainFilters) {
  return useQuery({
    queryKey: queryKeys.strains(filters),
    queryFn: () => api.strains.list(filters),
  });
}

/** All strains as an id -> Strain map, for name/rarity lookups across the app. */
export function useStrainMap() {
  const q = useQuery({
    queryKey: queryKeys.strains({}),
    queryFn: () => api.strains.list({}),
    staleTime: 60_000,
  });
  const map = new Map((q.data ?? []).map((s) => [s.id, s]));
  return { map, ...q };
}

export function useFavorites() {
  const { playerId, isAuthed } = useSession();
  return useQuery({
    queryKey: queryKeys.favorites(playerId ?? ""),
    queryFn: () => api.strains.favorites(playerId!),
    enabled: isAuthed,
  });
}

export function useMarket() {
  return useQuery({
    queryKey: queryKeys.market(),
    queryFn: () => api.market.list(),
    refetchInterval: 15_000,
  });
}

export function useContracts(status?: "open" | "fulfilled") {
  const { playerId, isAuthed } = useSession();
  return useQuery({
    queryKey: queryKeys.contracts(playerId ?? "", status),
    queryFn: () => api.contracts.list(playerId!, status),
    enabled: isAuthed,
  });
}

export function useLeaderboard(board: LeaderboardKind) {
  return useQuery({
    queryKey: queryKeys.leaderboard(board),
    queryFn: () => api.leaderboards.get(board),
  });
}

export function useStrain(strainId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.strain(strainId ?? ""),
    queryFn: () => api.strains.get(strainId!),
    enabled: !!strainId,
  });
}

export function useStrainKnowledge(strainId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.knowledge(strainId ?? ""),
    queryFn: () => api.strains.knowledge(strainId!),
    enabled: !!strainId,
  });
}

export function useProvenance(strainId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.provenance(strainId ?? ""),
    queryFn: () => api.strains.provenance(strainId!),
    enabled: !!strainId,
  });
}

export function useLineage(strainId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.lineage(strainId ?? ""),
    queryFn: () => api.strains.lineage(strainId!),
    enabled: !!strainId,
  });
}

export function useHarvests() {
  const { playerId, isAuthed } = useSession();
  return useQuery({
    queryKey: queryKeys.harvests(playerId ?? ""),
    queryFn: () => api.harvests.list(playerId!),
    enabled: isAuthed,
  });
}

export function useCupCurrent() {
  return useQuery({
    queryKey: queryKeys.cupCurrent(),
    queryFn: () => api.cup.current(),
    refetchInterval: 30_000,
  });
}

export function useCupStandings(cupId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.cupStandings(cupId ?? ""),
    queryFn: () => api.cup.standings(cupId!),
    enabled: !!cupId,
  });
}

export function useHallOfFame() {
  return useQuery({
    queryKey: queryKeys.hallOfFame(),
    queryFn: () => api.cup.hallOfFame(),
  });
}

export function useUniversityCatalog() {
  return useQuery({
    queryKey: queryKeys.uniCatalog(),
    queryFn: () => api.university.catalog(),
    staleTime: 60_000,
  });
}

export function useTranscript() {
  const { playerId, isAuthed } = useSession();
  return useQuery({
    queryKey: queryKeys.transcript(playerId ?? ""),
    queryFn: () => api.university.transcript(playerId!),
    enabled: isAuthed,
  });
}

export function useSeasonalStrains() {
  return useQuery({
    queryKey: queryKeys.seasonalStrains(),
    queryFn: () => api.seasonal.currentStrains(),
    staleTime: 60_000,
  });
}

export function useProfile() {
  const { playerId, isAuthed } = useSession();
  return useQuery({
    queryKey: queryKeys.profile(playerId ?? ""),
    queryFn: () => api.players.profile(playerId!),
    enabled: isAuthed,
  });
}

export function useStorePartners() {
  return useQuery({
    queryKey: queryKeys.storePartners(),
    queryFn: () => api.store.partners(),
    staleTime: 60_000,
  });
}

export function useStoreFeatured() {
  return useQuery({
    queryKey: queryKeys.storeFeatured(),
    queryFn: () => api.store.featured(),
    staleTime: 60_000,
  });
}

export function useStoreBundles() {
  return useQuery({
    queryKey: queryKeys.storeBundles(),
    queryFn: () => api.store.bundles(),
    staleTime: 60_000,
  });
}
