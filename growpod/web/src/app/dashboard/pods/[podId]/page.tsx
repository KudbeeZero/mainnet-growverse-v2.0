"use client";

// Pod interior — the middle level of the Pods → Pod → Plant drill-down. You
// reach it by clicking a pod on the dashboard; inside, you see that pod's
// plants (by name) and its environment controls, and clicking a plant opens the
// single plant screen. Reuses PodCard wholesale (controls + plant grid).

import { use } from "react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { LoadingBlock } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/States";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Button } from "@/components/ui/Button";
import { PodCard } from "@/components/pod/PodCard";
import { usePods, usePlantsList } from "@/hooks/queries";

function PodInterior({ podId }: { podId: string }) {
  const pods = usePods();
  const plants = usePlantsList();

  if (pods.isLoading) return <LoadingBlock label="Loading pod…" />;

  const pod = (pods.data ?? []).find((p) => p.id === podId);
  if (!pod) {
    return (
      <EmptyState
        icon="🪴"
        title="Pod not found"
        hint="It may have been removed, or it belongs to another account."
        action={
          <a href="/dashboard">
            <Button size="sm">← Back to pods</Button>
          </a>
        }
      />
    );
  }

  const plantIds = (plants.data ?? [])
    .filter((p) => p.pod_id === podId)
    .map((p) => p.id);

  return (
    <div className="space-y-4">
      <Breadcrumb items={[{ label: "Pods", href: "/dashboard" }, { label: pod.name }]} />
      <PodCard pod={pod} plantIds={plantIds} />
    </div>
  );
}

export default function PodPage({
  params,
}: {
  params: Promise<{ podId: string }>;
}) {
  const { podId } = use(params);
  return (
    <RequireAuth>
      <PodInterior podId={podId} />
    </RequireAuth>
  );
}
