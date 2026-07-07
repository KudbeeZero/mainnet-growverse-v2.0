"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingBlock } from "@/components/ui/Spinner";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/States";
import { DASHBOARD_COACH_MARKS } from "@/lib/coachMarks";
import { TokenClaimBanner } from "@/components/onboarding/TokenClaimBanner";
import { RestartTutorialButton } from "@/components/onboarding/RestartTutorialButton";
import { APP_VERSION } from "@/lib/version";
import { usePods, usePlantsList } from "@/hooks/queries";
import { useSession } from "@/lib/session";
import { useIdStore } from "@/lib/localStore";
import { useVisitStore } from "@/lib/visitStore";
import type { Plant } from "@/lib/types";

// The command center is the whole game surface — everything (carousel of plants,
// care, environment, ACCELERATE TIME, DNA) happens here, in one view.
const PodCommandCenter = dynamic(
  () => import("@/components/command/PodCommandCenter").then((m) => m.PodCommandCenter),
  { loading: () => <LoadingBlock label="Opening pod…" /> },
);
const PlantCard = dynamic(
  () => import("@/components/plant/PlantCard").then((m) => m.PlantCard),
  { loading: () => null },
);
const CreatePodForm = dynamic(
  () => import("@/components/pod/CreatePodForm").then((m) => m.CreatePodForm),
  { loading: () => null },
);
const ImportEntityForm = dynamic(
  () => import("@/components/onboarding/ImportEntityForm").then((m) => m.ImportEntityForm),
  { loading: () => null },
);
const CoachMarks = dynamic(
  () => import("@/components/onboarding/CoachMarks").then((m) => m.CoachMarks),
  { loading: () => null },
);

// Stable empty reference so the Zustand selector never returns a fresh array
// (which would loop useSyncExternalStore → React #185).
const NO_IDS: string[] = [];

const TWO_WEEKS_MS = 14 * 24 * 3600 * 1000;

function DashboardInner() {
  const { playerId } = useSession();
  const pods = usePods();
  const plants = usePlantsList();
  const localPlantIds =
    useIdStore((s) => (playerId ? s.ids[playerId]?.plantIds : undefined)) ?? NO_IDS;
  const [showCreate, setShowCreate] = useState(false);
  const [showNeglect, setShowNeglect] = useState(false);
  const [activePodId, setActivePodId] = useState<string | null>(null);

  // On mount: check for long absence, then record this visit.
  useEffect(() => {
    const { lastVisitMs: lv, markVisit: mv } = useVisitStore.getState();
    if (lv > 0 && Date.now() - lv > TWO_WEEKS_MS) setShowNeglect(true);
    mv();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const podList = useMemo(() => pods.data ?? [], [pods.data]);
  const plantList = useMemo(() => plants.data ?? [], [plants.data]);

  // Group plants by pod (full objects — the carousel/command center needs them).
  const plantsByPod = useMemo(() => {
    const m = new Map<string, Plant[]>();
    for (const p of plantList) {
      const arr = m.get(p.pod_id) ?? [];
      arr.push(p);
      m.set(p.pod_id, arr);
    }
    return m;
  }, [plantList]);

  // Keep the selected pod valid as pods load / change.
  useEffect(() => {
    if (podList.length === 0) {
      if (activePodId !== null) setActivePodId(null);
    } else if (!activePodId || !podList.some((p) => p.id === activePodId)) {
      setActivePodId(podList[0].id);
    }
  }, [podList, activePodId]);

  if (pods.isLoading) return <LoadingBlock label="Loading your grow…" />;

  const activePod = podList.find((p) => p.id === activePodId) ?? podList[0];
  const knownIds = new Set(plantList.map((p) => p.id));
  const orphanLocal = localPlantIds.filter((id) => !knownIds.has(id));

  return (
    <div className="space-y-6">
      {showNeglect && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-600/50 bg-amber-950/30 px-4 py-3">
          <span className="text-xl">⏳</span>
          <div className="flex-1 text-sm text-amber-200">
            <span className="font-semibold">Welcome back!</span> It&apos;s been over two weeks — your
            plants have been running their stress clock without you. Check health and
            conditions carefully before doing anything else.
          </div>
          <button
            onClick={() => setShowNeglect(false)}
            className="mt-0.5 text-xs text-amber-400 hover:text-amber-200"
          >
            ✕
          </button>
        </div>
      )}

      <PageHeader
        eyebrow="⌖ GROW OPS"
        title="Command Center"
        subtitle="Pick a plant, care for it, and accelerate time — all from here."
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
          </div>
        }
      />

      <div className="flex justify-end">
        <span
          data-onboarding="app-version"
          className="rounded-full border border-ink-600 bg-ink-800 px-2 py-0.5 font-mono text-[10px] text-gray-400"
          title="Build version — bumps with each shipped update"
        >
          🌿 GrowPod Empire · v{APP_VERSION}
        </span>
      </div>

      <TokenClaimBanner />

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
        <div className="space-y-3" data-coach="your-grows">
          {/* Pod switcher (only when there's more than one pod). */}
          {podList.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {podList.map((pod) => {
                const count = (plantsByPod.get(pod.id) ?? []).length;
                const active = pod.id === activePod?.id;
                return (
                  <button
                    key={pod.id}
                    type="button"
                    onClick={() => setActivePodId(pod.id)}
                    aria-pressed={active}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? "border-cyan-300/50 bg-cyan-400/10 text-cyan-100"
                        : "border-ink-600 bg-ink-800 text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    {pod.name}
                    <span className="ml-1.5 text-[10px] text-gray-500">
                      {count}/{Math.min(4, pod.capacity || 4)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {activePod && (
            <PodCommandCenter
              key={activePod.id}
              pod={activePod}
              plants={plantsByPod.get(activePod.id) ?? []}
            />
          )}
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

      <details className="group rounded-xl border border-ink-700 bg-ink-900/40">
        <summary className="cursor-pointer list-none px-4 py-2 text-xs text-gray-500 transition-colors hover:text-gray-300">
          ⤓ Recover a plant by ID
        </summary>
        <div className="px-4 pb-4">
          <p className="mb-2 text-xs text-gray-500">
            Switched devices or cleared storage? Import a plant by its ID.
          </p>
          <ImportEntityForm />
        </div>
      </details>

      {/* First-session guidance — points at the real UI, once per player. */}
      <CoachMarks marks={DASHBOARD_COACH_MARKS} />

      <div className="flex justify-center pt-2">
        <RestartTutorialButton />
      </div>
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
