"use client";

import { useState, useEffect } from "react";
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
import { useDevSpeedStore } from "@/lib/devSpeedStore";
import { useTurbo } from "@/hooks/useTurbo";

const PodCard = dynamic(
  () => import("@/components/pod/PodCard").then((m) => m.PodCard),
  { loading: () => null },
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

  // ⚡ Global 10× speed faucet is server-owned (see useTurbo): the toggle lives in
  // the nav and accelerates EVERY pod account-wide. Here we only auto-stop it once
  // a plant is harvest-ready so a QA run doesn't overshoot.
  const { enabled: devSpeed, setEnabled: setTurbo } = useTurbo(playerId);

  // On mount: check for long absence, then record this visit.
  useEffect(() => {
    const { lastVisitMs: lv, markVisit: mv } = useDevSpeedStore.getState();
    if (lv > 0 && Date.now() - lv > TWO_WEEKS_MS) setShowNeglect(true);
    mv();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-stop the faucet when any plant hits harvest-ready (server-side off).
  useEffect(() => {
    if (!devSpeed) return;
    const ready = (plants.data ?? []).some(
      (p) => p.is_alive && !p.harvested && p.growth_stage === "harvest",
    );
    if (ready) setTurbo(false);
  }, [plants.data, devSpeed, setTurbo]);

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
