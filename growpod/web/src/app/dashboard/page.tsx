"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingBlock } from "@/components/ui/Spinner";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/States";
import { CreatePodForm } from "@/components/pod/CreatePodForm";
import { PodCard } from "@/components/pod/PodCard";
import { PlantCard } from "@/components/plant/PlantCard";
import { ImportEntityForm } from "@/components/onboarding/ImportEntityForm";
import { CoachMarks } from "@/components/onboarding/CoachMarks";
import { DASHBOARD_COACH_MARKS } from "@/lib/coachMarks";
import { usePods, usePlantsList } from "@/hooks/queries";
import { useSession } from "@/lib/session";
import { useIdStore } from "@/lib/localStore";

// Stable empty reference so the Zustand selector never returns a fresh array
// (which would loop useSyncExternalStore → React #185).
const NO_IDS: string[] = [];

function DashboardInner() {
  const { playerId } = useSession();
  const pods = usePods();
  const plants = usePlantsList();
  const localPlantIds =
    useIdStore((s) => (playerId ? s.ids[playerId]?.plantIds : undefined)) ?? NO_IDS;
  const [showCreate, setShowCreate] = useState(false);

  // ⚡ Dev speed state — drives real backend clock + smooth decimal display
  const [devSpeed, setDevSpeed] = useState(false);
  const [gameHoursElapsed, setGameHoursElapsed] = useState(0);
  const lastTickMs = useRef<number>(0);
  const [tickFraction, setTickFraction] = useState(0);

  // Main 700ms clock tick: advance 1 game-hour, then refetch plants.
  useEffect(() => {
    if (!devSpeed) {
      setGameHoursElapsed(0);
      setTickFraction(0);
      return;
    }
    const id = setInterval(async () => {
      lastTickMs.current = Date.now();
      setTickFraction(0);
      setGameHoursElapsed((h) => h + 1);
      try {
        await fetch("/api/dev/clock/advance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hours: 1 }),
        });
        plants.refetch();
      } catch {
        // dev clock may not be available
      }
    }, 700);
    return () => clearInterval(id);
  }, [devSpeed, plants]);

  // Smooth 40ms interpolation between ticks — drives decimal precision on the counter.
  useEffect(() => {
    if (!devSpeed) return;
    const id = setInterval(() => {
      setTickFraction(Math.min((Date.now() - lastTickMs.current) / 700, 1));
    }, 40);
    return () => clearInterval(id);
  }, [devSpeed]);

  // Total elapsed game time with smooth sub-hour precision
  const totalGameHours = gameHoursElapsed + tickFraction;
  const gameDays = (totalGameHours / 24).toFixed(2);

  if (pods.isLoading) return <LoadingBlock label="Loading your grow…" />;

  const podList = pods.data ?? [];
  const liveCount = (plants.data ?? []).filter((p) => p.is_alive && !p.harvested).length;

  const byPod = new Map<string, string[]>();
  for (const p of plants.data ?? []) {
    const arr = byPod.get(p.pod_id) ?? [];
    arr.push(p.id);
    byPod.set(p.pod_id, arr);
  }
  const knownIds = new Set((plants.data ?? []).map((p) => p.id));
  const orphanLocal = localPlantIds.filter((id) => !knownIds.has(id));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`⌖ ${liveCount} LIVE PLANTS · ${podList.length} PODS`}
        title="Grow Dashboard"
        subtitle="Plants advance in real time as you watch. VPD, DLI and PPFD are live — keep them in band and care before they wilt."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/lab">
              <Button variant="secondary" size="sm" data-coach="buy-seeds">
                Buy seeds
              </Button>
            </Link>
            <Button size="sm" data-coach="new-pod" onClick={() => setShowCreate((s) => !s)}>
              + New Pod
            </Button>
            {/* ⚡ Dev speed toggle — wired to real backend clock */}
            <button
              onClick={() => setDevSpeed((s) => !s)}
              title={devSpeed ? "10× speed ON — tap to disable" : "10× speed OFF — tap to enable"}
              className={`flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 font-extrabold tracking-wide transition-all text-xs ${
                devSpeed
                  ? "border-green-400 bg-green-500/20 text-green-300 shadow-[0_0_12px_rgba(74,222,128,0.4)]"
                  : "border-ink-600 bg-ink-800 text-gray-400 hover:border-green-700 hover:text-green-500"
              }`}
            >
              <span>⚡ 10×</span>
              {devSpeed && (
                <span className="font-mono text-green-200">+{gameDays}d</span>
              )}
            </button>
          </div>
        }
      />

      {showCreate && (
        <Card className="max-w-md">
          <CardHeader title="Create a grow pod" />
          <CreatePodForm onCreated={() => setShowCreate(false)} />
        </Card>
      )}

      {podList.length === 0 ? (
        <EmptyState
          icon="🌱"
          title="No grow pods yet"
          hint="Create a pod, then plant a seed from the Lab to start the simulation."
          action={
            <Button size="sm" onClick={() => setShowCreate(true)}>
              + New Pod
            </Button>
          }
        />
      ) : (
        <div className="space-y-6" data-coach="your-grows">
          {podList.map((pod) => (
            <PodCard key={pod.id} pod={pod} plantIds={byPod.get(pod.id) ?? []} />
          ))}
        </div>
      )}

      {orphanLocal.length > 0 && (
        <Card>
          <CardHeader
            title="Other tracked plants"
            subtitle="Plants saved locally but not in a loaded pod."
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {orphanLocal.map((id) => (
              <PlantCard key={id} playerId={playerId!} plantId={id} />
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Recover a plant"
          subtitle="Switched devices or cleared storage? Import a plant by its ID."
        />
        <ImportEntityForm />
      </Card>

      {/* First-session guidance — points at the real UI, once per player. */}
      <CoachMarks marks={DASHBOARD_COACH_MARKS} />

      {/* Mobile: floating pill shows elapsed game time when 10× is active */}
      {devSpeed && (
        <button
          onClick={() => setDevSpeed(false)}
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-green-400 bg-green-500/20 px-4 py-2 font-mono text-xs font-extrabold text-green-300 shadow-[0_0_16px_rgba(74,222,128,0.5)] lg:hidden"
        >
          ⚡ 10× · +{gameDays} game days · tap to stop
        </button>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardInner />
    </RequireAuth>
  );
}
