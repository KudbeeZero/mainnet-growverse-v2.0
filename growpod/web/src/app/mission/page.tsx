"use client";

// Mission Control v0 — owner/admin-only internal operations board.
//
// Visibility (HONEST, not a role system): not linked in nav + requires login
// (RequireAuth) + gated by isMissionControlEnabled() (build flag or dev bypass).
// Everything shown is real readable data; unwired systems are labeled as such.

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { PageHeader, Section } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { LoadingBlock } from "@/components/ui/Spinner";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Badge } from "@/components/ui/Badge";
import { usePlantsList } from "@/hooks/queries";
import { usePlantState } from "@/hooks/usePlantState";
import { useSession } from "@/lib/session";
import { isMissionControlEnabled, isDevBypassEnabled } from "@/lib/features";
import { apiFetch } from "@/lib/api/client";
import { buildPacketsForPlant } from "@/lib/mission/packets";
import { buildWiringRows, wiringSummary } from "@/lib/mission/wiring";
import { MissionPacketCard } from "@/components/mission/MissionPacketCard";
import { WiringPanel } from "@/components/mission/WiringPanel";
import { SystemPulse } from "@/components/mission/SystemPulse";
import { FutureFeeds } from "@/components/mission/FutureFeeds";
import { STAGE_INFO } from "@/lib/stageInfo";

export default function MissionControlPage() {
  // No hooks above this branch — safe conditional return.
  if (!isMissionControlEnabled()) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <PageHeader eyebrow="GrowVerse · Internal" title="Mission Control" />
        <Card>
          <CardHeader title="Not enabled in this build" subtitle="Owner/admin-only operations board." />
          <p className="text-sm text-gray-400">
            Mission Control v0 is gated behind <code className="text-gray-300">NEXT_PUBLIC_ENABLE_MISSION_CONTROL=true</code>{" "}
            (or the dev/test bypass). It is intentionally hidden from players until the public-facing
            version is ready. This is a build-flag + login gate, <strong>not</strong> a role-based
            permission system.
          </p>
        </Card>
      </main>
    );
  }
  return (
    <RequireAuth>
      <MissionBoard />
    </RequireAuth>
  );
}

function MissionBoard() {
  const { playerId } = useSession();
  const plantsQ = usePlantsList();
  const plants = plantsQ.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Default to an actively-growing plant; don't silently surface a dead/harvested
  // one (that would render full packets where "No grow to monitor" is honest).
  // The selector can still target any plant explicitly.
  const activePlant =
    (selectedId ? plants.find((p) => p.id === selectedId) : undefined) ??
    plants.find((p) => p.is_alive && !p.harvested) ??
    null;

  const stateQ = usePlantState(playerId ?? "", activePlant?.id ?? "", Boolean(activePlant));
  const state = stateQ.data;

  // Live wiring probes (read-only, public endpoints; failures are shown honestly).
  const flagsQ = useQuery({
    queryKey: ["mission", "flags"],
    queryFn: () => apiFetch<{ flags: Record<string, boolean> }>("/flags", { auth: false }),
    retry: false,
    staleTime: 30_000,
  });
  const healthQ = useQuery({
    queryKey: ["mission", "health"],
    queryFn: () => apiFetch<{ status: string }>("/health", { raw: true, auth: false }),
    retry: false,
    staleTime: 30_000,
  });

  const packets = useMemo(() => (state ? buildPacketsForPlant(state) : []), [state]);

  const wiringRows = useMemo(
    () =>
      buildWiringRows({
        plantConnected: Boolean(state),
        forecastConnected: Boolean(state?.forecast),
        metricsConnected: Boolean(
          state?.metrics &&
            (state.metrics.vpd_kpa != null || state.metrics.ppfd != null || state.metrics.dli_mol != null),
        ),
        eventsConnected: Boolean(state?.recent_events?.length),
        flagsReachable: flagsQ.isSuccess,
        healthReachable: healthQ.isSuccess ? true : healthQ.isError ? false : null,
        qaSpeedReadable: isDevBypassEnabled(),
      }),
    [state, flagsQ.isSuccess, healthQ.isSuccess, healthQ.isError],
  );
  const summary = useMemo(() => wiringSummary(wiringRows), [wiringRows]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <PageHeader
        eyebrow="GrowVerse · Internal"
        title="Mission Control"
        subtitle="v0 — owner/admin-only operations board. Real readable data; unwired systems are labeled honestly."
      />

      <div className="mb-4 rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
        Owner/admin-only (v0): gated by build flag + login, not a role system. Not linked in nav.
        PR & deploy feeds are <strong>not wired yet</strong>; staking is intentionally not wired.
      </div>

      <div className="mb-4">
        <SystemPulse summary={summary} packets={packets} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Main lane: grow packets */}
        <div className="lg:col-span-2">
          <Section
            title="Grow Packets"
            action={
              plants.length > 1 ? (
                <select
                  value={activePlant?.id ?? ""}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="rounded-md border border-ink-600 bg-ink-800 px-2 py-1 text-xs text-gray-200"
                >
                  {plants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {STAGE_INFO[p.growth_stage].label} · {p.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              ) : undefined
            }
          >
            {plantsQ.isLoading ? (
              <LoadingBlock label="Loading grow fleet…" />
            ) : plantsQ.error ? (
              <ErrorState error={plantsQ.error} onRetry={() => plantsQ.refetch()} />
            ) : !activePlant ? (
              <EmptyState
                icon="🌱"
                title="No grow to monitor yet"
                hint="Plant a seed on the dashboard and packets will start flowing here from real plant state."
              />
            ) : stateQ.isLoading && !state ? (
              <LoadingBlock label="Reading plant state…" />
            ) : stateQ.error ? (
              <ErrorState error={stateQ.error} onRetry={() => stateQ.refetch()} />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {packets.map((p) => (
                  <MissionPacketCard key={p.id} packet={p} />
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Side lane: health, wiring, future */}
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Backend / API Health"
              subtitle="Live read-only probes. Honest about reachability."
            />
            <ul className="space-y-2 text-xs">
              <li className="flex items-center justify-between gap-2">
                <span className="text-gray-300">Feature flags (/api/game/flags)</span>
                {flagsQ.isLoading ? (
                  <Badge className="border-ink-600 bg-ink-700 text-gray-400">checking…</Badge>
                ) : flagsQ.isSuccess ? (
                  <Badge className="border-grow-700 bg-grow-900/50 text-grow-200">reachable</Badge>
                ) : (
                  <Badge className="border-sky-800 bg-sky-950/50 text-sky-200">unreachable</Badge>
                )}
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="text-gray-300">Liveness (/health)</span>
                {healthQ.isLoading ? (
                  <Badge className="border-ink-600 bg-ink-700 text-gray-400">checking…</Badge>
                ) : healthQ.isSuccess ? (
                  <Badge className="border-grow-700 bg-grow-900/50 text-grow-200">ok</Badge>
                ) : (
                  <Badge className="border-sky-800 bg-sky-950/50 text-sky-200">unconfirmed</Badge>
                )}
              </li>
              {flagsQ.isSuccess && flagsQ.data?.flags && (
                <li className="pt-1">
                  <div className="mb-1 text-[10px] uppercase tracking-wide text-gray-500">Live flags</div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(flagsQ.data.flags).map(([k, v]) => (
                      <Badge
                        key={k}
                        className={
                          v
                            ? "border-grow-700 bg-grow-900/50 text-grow-200"
                            : "border-ink-600 bg-ink-700 text-gray-400"
                        }
                      >
                        {k}: {v ? "on" : "off"}
                      </Badge>
                    ))}
                  </div>
                </li>
              )}
              {!flagsQ.isLoading && !flagsQ.isSuccess && (
                <li className="text-gray-500">
                  Live flags endpoint not reachable from the browser — the app falls back to
                  build-time flags. Not faking a green status.
                </li>
              )}
            </ul>
          </Card>

          <WiringPanel rows={wiringRows} />
          <FutureFeeds />
        </div>
      </div>
    </main>
  );
}
