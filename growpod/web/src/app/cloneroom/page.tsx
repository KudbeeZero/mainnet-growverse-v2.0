"use client";

import { useCallback, useEffect, useState } from "react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { useSession } from "@/lib/session";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api/client";
import {
  cloneCut,
  harvest,
  listSeeds,
  mintSeed,
  resolveEvent,
  startGrow,
  tendPlant,
  type CloneCutResult,
  type HarvestResult,
  type PendingEvent,
  type PlantGrow,
  type PlantSeed,
  type SeedTraits,
  type StoryEvent,
} from "@/lib/api/cloneRoom";

// ---------------------------------------------------------------------------
// Clone Room — wires the FRONTIER api-server loop (mint → grow → tend → clone
// → harvest) into the UI. The backend is gated by a shared admin key
// (NEXT_PUBLIC_PLANT_ADMIN_KEY); see src/lib/api/cloneRoom.ts.
// ---------------------------------------------------------------------------

function describeTraits(t: SeedTraits | null): string {
  if (!t) return "unknown genetics";
  return [
    t.strainFamily,
    `growth ×${t.growthRate.toFixed(2)}`,
    `resin ${(t.resinProfile * 100).toFixed(0)}%`,
    t.mutationFlag ? "mutation" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default function CloneRoomPage() {
  const { playerId, isAuthed } = useSession();
  const toast = useToast();

  const [seeds, setSeeds] = useState<PlantSeed[]>([]);
  const [activeGrow, setActiveGrow] = useState<PlantGrow | null>(null);
  const [activeSeed, setActiveSeed] = useState<PlantSeed | null>(null);
  const [pendingEvent, setPendingEvent] = useState<PendingEvent | null>(null);
  const [storyEvents, setStoryEvents] = useState<StoryEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const refreshSeeds = useCallback(async () => {
    if (!playerId) return;
    setLoading(true);
    try {
      const { seeds: list } = await listSeeds(playerId);
      setSeeds(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load seeds");
    } finally {
      setLoading(false);
    }
  }, [playerId, toast]);

  useEffect(() => {
    if (isAuthed && playerId) void refreshSeeds();
  }, [isAuthed, playerId, refreshSeeds]);

  const guard = (): boolean => {
    if (!playerId) {
      toast.error("Sign in first");
      return false;
    }
    if (!process.env.NEXT_PUBLIC_PLANT_ADMIN_KEY) {
      toast.error("Clone Room is not configured (missing admin key)");
      return false;
    }
    return true;
  };

  const handleMint = async () => {
    if (!guard() || !playerId) return;
    setBusy(true);
    try {
      // Dev wallet stand-in; the backend derives genetics from this address.
      const ownerAddress = `player:${playerId}`;
      const { seed } = await mintSeed({
        ownerAddress,
        playerId,
        generationNum: 0,
      });
      setSeeds((s) => [seed, ...s]);
      toast.success("Seed minted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Mint failed");
    } finally {
      setBusy(false);
    }
  };

  const handleStartGrow = async (seed: PlantSeed) => {
    if (!guard()) return;
    setBusy(true);
    try {
      const { grow } = await startGrow(seed.seedId, playerId!);
      setActiveGrow(grow);
      setActiveSeed(seed);
      setPendingEvent(null);
      setStoryEvents([]);
      toast.success("Grow started");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start grow");
    } finally {
      setBusy(false);
    }
  };

  const handleTend = async () => {
    if (!activeGrow || !guard()) return;
    setBusy(true);
    try {
      const res = await tendPlant(activeGrow.growId);
      setActiveGrow(res.grow);
      setPendingEvent(res.pendingEvent);
      toast.success("Tended");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tend failed");
    } finally {
      setBusy(false);
    }
  };

  const handleResolve = async (eventType: string, choiceId: string) => {
    if (!activeGrow || !guard()) return;
    setBusy(true);
    try {
      const { event } = await resolveEvent(activeGrow.growId, eventType, choiceId);
      setStoryEvents((ev) => [...ev, event]);
      setPendingEvent(null);
      toast.success("Choice recorded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Resolve failed");
    } finally {
      setBusy(false);
    }
  };

  const handleClone = async () => {
    if (!activeGrow || !guard()) return;
    setBusy(true);
    try {
      const res: CloneCutResult = await cloneCut(activeGrow.growId);
      setActiveGrow((g) => (g ? { ...g, cloneCut: true } : g));
      toast.success("Clone cut — new Gen N+1 seed minted");
      await refreshSeeds();
      void res;
    } catch (e) {
      const msg = e instanceof ApiError && e.status === 409 ? "Not eligible yet" : e instanceof Error ? e.message : "Clone failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleHarvest = async () => {
    if (!activeGrow || !guard()) return;
    setBusy(true);
    try {
      const res: HarvestResult = await harvest(activeGrow.growId);
      setActiveGrow((g) =>
        g ? { ...g, stage: "complete", rarityTier: res.rarityTier, harvestNftId: res.harvestNftId } : g,
      );
      toast.success(`Harvested — ${res.rarityTier ?? "unknown"} rarity`);
    } catch (e) {
      const msg = e instanceof ApiError && e.status === 409 ? "Not ready to harvest" : e instanceof Error ? e.message : "Harvest failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const resetGrow = () => {
    setActiveGrow(null);
    setActiveSeed(null);
    setPendingEvent(null);
    setStoryEvents([]);
  };

  return (
    <RequireAuth>
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader
          eyebrow="FRONTIER"
          title="Clone Room"
          subtitle="Mint a seed, grow it, cut clones, and harvest a proof-of-play NFT."
        />

        <div className="grid gap-6 md:grid-cols-2">
          {/* Seed vault + mint */}
          <Card>
            <CardHeader
              title="Seed Vault"
              subtitle="Your minted Seed NFTs"
              action={
                <Button size="sm" onClick={handleMint} loading={busy} disabled={!isAuthed}>
                  Mint seed
                </Button>
              }
            />
            {loading ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : seeds.length === 0 ? (
              <EmptyState title="No seeds yet" hint="Mint a Gen 0 seed to begin the loop." />
            ) : (
              <ul className="space-y-2">
                {seeds.map((s) => (
                  <li
                    key={s.seedId}
                    className="flex items-center justify-between rounded-lg border border-ink-600 bg-ink-700/50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-mono text-xs text-gray-300">
                        {s.seedId.slice(0, 8)}… · Gen {s.generationNum}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {describeTraits(s.traits)}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={activeSeed?.seedId === s.seedId ? "secondary" : "primary"}
                      disabled={!isAuthed || (!!activeGrow && activeSeed?.seedId !== s.seedId)}
                      onClick={() => handleStartGrow(s)}
                    >
                      {activeSeed?.seedId === s.seedId && activeGrow ? "Growing" : "Plant"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Active grow */}
          <Card>
            <CardHeader
              title="Active Grow"
              subtitle={activeGrow ? `Stage: ${activeGrow.stage}` : "No grow in progress"}
              action={
                activeGrow ? (
                  <Button size="sm" variant="ghost" onClick={resetGrow}>
                    Clear
                  </Button>
                ) : undefined
              }
            />
            {!activeGrow ? (
              <EmptyState title="Plant a seed" hint="Pick a seed from the vault to start a grow." />
            ) : (
              <div className="space-y-3">
                <div className="text-xs text-gray-400">
                  {describeTraits(activeSeed?.traits ?? null)}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={handleTend} loading={busy} disabled={activeGrow.stage === "complete"}>
                    Tend
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleClone}
                    loading={busy}
                    disabled={activeGrow.cloneCut || activeGrow.stage === "complete"}
                  >
                    {activeGrow.cloneCut ? "Cloned" : "Cut clone"}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={handleHarvest}
                    loading={busy}
                    disabled={activeGrow.stage === "complete"}
                  >
                    Harvest
                  </Button>
                </div>

                {pendingEvent && (
                  <div className="rounded-lg border border-grow-700 bg-grow-900/30 p-3">
                    <div className="mb-2 text-sm font-medium text-grow-200">
                      {pendingEvent.prompt}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {pendingEvent.choices.map((c) => (
                        <Button
                          key={c.choiceId}
                          size="sm"
                          variant="secondary"
                          onClick={() => handleResolve(pendingEvent.eventType, c.choiceId)}
                          disabled={busy}
                        >
                          {c.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {activeGrow.stage === "complete" && (
                  <div className="rounded-lg border border-ink-600 bg-ink-700/50 p-3 text-sm">
                    <div className="font-medium text-gray-100">Harvest complete</div>
                    <div className="text-gray-400">
                      Rarity: {activeGrow.rarityTier ?? "—"}
                      {activeGrow.harvestNftId ? ` · NFT ${activeGrow.harvestNftId}` : ""}
                    </div>
                  </div>
                )}

                {storyEvents.length > 0 && (
                  <div className="text-[11px] text-gray-500">
                    {storyEvents.length} story event(s) resolved
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </RequireAuth>
  );
}
