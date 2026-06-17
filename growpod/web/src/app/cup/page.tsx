"use client";

import { useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LoadingBlock } from "@/components/ui/Spinner";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/States";
import { Metric } from "@/components/ui/Metric";
import { Countdown } from "@/components/ui/Countdown";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useCupCurrent, useHarvests, useStrainMap } from "@/hooks/queries";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { queryKeys } from "@/lib/queryKeys";
import { grow, num, titleCase } from "@/lib/format";

function CupInner() {
  const { playerId } = useSession();
  const current = useCupCurrent();
  const [enterOpen, setEnterOpen] = useState(false);

  if (current.isLoading) return <LoadingBlock label="Loading the Cup…" />;

  const cup = current.data?.cup ?? null;
  const standings = current.data?.standings ?? [];

  if (!cup)
    return (
      <div className="space-y-5">
        <CupHeader />
        <EmptyState icon="🏆" title="No Cup running right now" hint="Check back next season — and visit the Hall of Fame for past champions." />
      </div>
    );

  const open = cup.status === "open";

  return (
    <div className="space-y-5">
      <CupHeader />

      <Card className="canvas-dark">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="instrument-label mb-1">{cup.edition} · {titleCase(cup.season)}</div>
            <h2 className="text-2xl font-bold text-gray-50">{cup.title}</h2>
            <div className="mt-1">
              <Badge className={open ? "border-grow-600 bg-grow-900/60 text-grow-200" : "border-ink-600 bg-ink-700 text-gray-300"}>
                {titleCase(cup.status)}
              </Badge>
            </div>
          </div>
          {open && (
            <Button onClick={() => setEnterOpen(true)}>🏆 Enter a harvest</Button>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="Prize pool" value={grow(cup.prize_pool)} tone="grow" />
          <Metric label="Entry fee" value={grow(cup.entry_fee)} />
          <Metric label={open ? "Closes in" : "Closed"} value={open ? <Countdown to={cup.ends_at} /> : "—"} />
          <Metric label="Entries" value={standings.length} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Standings" subtitle="Deterministic server-side cup score — top entries" />
        {standings.length === 0 ? (
          <p className="text-sm text-gray-500">No entries yet. Be the first to enter a harvest.</p>
        ) : (
          <ol className="divide-y divide-ink-700">
            {standings.map((e, i) => (
              <li
                key={e.id}
                className={`flex items-center justify-between py-2 ${
                  e.player_id === playerId ? "text-grow-300" : "text-gray-200"
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className="instrument-value w-6 text-right text-gray-500">{e.rank ?? i + 1}</span>
                  <span className="font-medium">{e.strain_name}</span>
                  {e.player_id === playerId && <span className="text-xs text-gray-500">(you)</span>}
                </span>
                <span className="flex items-center gap-4">
                  {e.prize_grow > 0 && <span className="text-xs text-amber-300">{grow(e.prize_grow)}</span>}
                  <span className="instrument-value">{num(e.score, 1)}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {enterOpen && <EnterModal cupOpen={open} onClose={() => setEnterOpen(false)} />}
    </div>
  );
}

function CupHeader() {
  return (
    <PageHeader
      eyebrow="SEASONAL · CANNABIS CUP"
      title="Cannabis Cup"
      subtitle="One Cup per season. The champion earns a one-of-a-kind legendary trophy strain, a permanent title, and a place in the Hall of Fame."
      action={
        <Link href="/cup/hall-of-fame">
          <Button variant="secondary">♛ Hall of Fame</Button>
        </Link>
      }
    />
  );
}

function EnterModal({ cupOpen, onClose }: { cupOpen: boolean; onClose: () => void }) {
  const { playerId } = useSession();
  const harvests = useHarvests();
  const { map } = useStrainMap();
  const eligible = (harvests.data ?? []).filter((h) => !h.sold);

  const enter = useApiMutation((harvestId: string) => api.cup.enter(playerId!, harvestId), {
    invalidate: [queryKeys.cupCurrent(), queryKeys.wallet(playerId ?? ""), queryKeys.harvests(playerId ?? "")],
    successMessage: (r) => `Entered — cup score ${num(r.score, 1)}`,
    onSuccess: onClose,
  });

  return (
    <Modal open onClose={onClose} title="Enter a harvest into the Cup">
      {!cupOpen ? (
        <p className="text-sm text-gray-400">This Cup has closed.</p>
      ) : harvests.isLoading ? (
        <LoadingBlock />
      ) : eligible.length === 0 ? (
        <p className="text-sm text-gray-400">
          No eligible harvests. Grow and harvest a plant first — higher quality &amp; rarity score better.
        </p>
      ) : (
        <ul className="space-y-2">
          {eligible.map((h) => (
            <li
              key={h.id}
              className="flex items-center justify-between gap-2 rounded-md border border-ink-700 bg-ink-900/50 px-3 py-2"
            >
              <div className="text-sm">
                <div className="text-gray-200">{map.get(h.strain_id)?.name ?? "Harvest"}</div>
                <div className="text-xs text-gray-500">
                  {num(h.weight_g, 1)} g · quality {num(h.quality, 0)} · {titleCase(h.rarity)}
                </div>
              </div>
              <Button
                size="sm"
                loading={enter.isPending && enter.variables === h.id}
                onClick={() => enter.mutate(h.id)}
              >
                Enter
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

export default function CupPage() {
  return (
    <RequireAuth>
      <CupInner />
    </RequireAuth>
  );
}
