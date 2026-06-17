"use client";

import { useState } from "react";
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
          <div className="flex items-center gap-2">
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
