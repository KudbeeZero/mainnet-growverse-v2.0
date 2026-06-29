"use client";

// PUBLIC pre-launch door (no auth): pick a faction, see the live signup standings,
// and — if you're in — join the launch waitlist by connecting an Algorand wallet
// or pasting an address (+ optional email). NON-economic: it stores an address for
// a future reward; nothing here spends or earns currency. Degrades gracefully when
// the `faction_waitlist` flag is off (the API 404s → "opening soon").

import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { CinematicBackdrop } from "@/components/landing/CinematicBackdrop";
import { GrainOverlay } from "@/components/landing/GrainOverlay";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useSmoothScroll } from "@/lib/scroll/useSmoothScroll";
import { useReveal } from "@/lib/scroll/reveal";
import { api, ApiError } from "@/lib/api";
import { factionShares } from "@/lib/factions";
import type { Faction, WaitlistSignup } from "@/lib/types";

export default function FactionsPage() {
  const qc = useQueryClient();
  const reduced = usePrefersReducedMotion();
  useSmoothScroll(!reduced);
  const revealRef = useRef<HTMLDivElement>(null);
  useReveal(revealRef, !reduced, { start: "top 92%", stagger: 0.08 });
  const factionsQ = useQuery({
    queryKey: ["factions"],
    queryFn: () => api.waitlist.factions(),
    staleTime: 10 * 60_000,
    retry: false,
  });
  const standingsQ = useQuery({
    queryKey: ["waitlistStandings"],
    queryFn: () => api.waitlist.standings(),
    staleTime: 30_000,
    retry: false,
  });

  const [picked, setPicked] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState<WaitlistSignup | null>(null);
  const [error, setError] = useState<string | null>(null);

  const factions = factionsQ.data?.factions ?? [];
  const ids = useMemo(() => factions.map((f) => f.id), [factions]);
  const shares = useMemo(() => factionShares(standingsQ.data, ids), [standingsQ.data, ids]);
  const total = standingsQ.data?.total ?? 0;

  const join = useMutation({
    mutationFn: () =>
      api.waitlist.join({
        faction: picked!,
        algorand_address: address.trim() || undefined,
        email: email.trim() || undefined,
        source: "factions_landing",
      }),
    onSuccess: (signup) => {
      setJoined(signup);
      setError(null);
      qc.invalidateQueries({ queryKey: ["waitlistStandings"] });
    },
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : "Couldn't join the waitlist — try again."),
  });

  // Flag off / API unavailable → tasteful "opening soon" state.
  if (factionsQ.isError) {
    return (
      <>
        <CinematicBackdrop />
        <GrainOverlay />
        <div className="relative z-10 py-10">
          <EmptyState
            icon="🌱"
            title="Factions are opening soon"
            hint="The pre-launch faction draft isn't live yet — check back shortly."
          />
        </div>
      </>
    );
  }

  const pickedFaction = factions.find((f) => f.id === picked) ?? null;

  return (
    <>
      <CinematicBackdrop />
      <GrainOverlay />
      <div ref={revealRef} className="relative z-10 space-y-6 py-6">
      <div data-reveal>
        <PageHeader
          eyebrow="GROWVERSE · CHOOSE YOUR SIDE"
          title="Pick your faction"
          subtitle="Three lineages, one grow. Align with yours, claim your spot on the launch waitlist — the more you commit now, the bigger your reward at launch."
        />
      </div>

      {/* Faction cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {factions.map((f) => (
          <FactionCard
            key={f.id}
            faction={f}
            selected={picked === f.id}
            share={shares[f.id] ?? 0}
            onPick={() => {
              setPicked(f.id);
              setJoined(null);
            }}
          />
        ))}
      </div>
      <p data-reveal className="text-center text-xs text-gray-500">
        {total > 0 ? `${total.toLocaleString()} growers have aligned so far` : "Be the first to align"}
      </p>

      {/* Join panel */}
      {picked && (
        <div data-reveal className="mx-auto max-w-lg space-y-4 rounded-2xl border border-grow-700/50 bg-ink-900/60 p-5">
          {joined ? (
            <div className="space-y-1 text-center">
              <div className="text-3xl">{pickedFaction?.crest}</div>
              <p className="font-semibold text-grow-100">
                You&apos;re on the list with {pickedFaction?.name}.
              </p>
              <p className="text-sm text-gray-400">
                The more you grow with us, the bigger your launch reward. See you in the pod. 🌿
              </p>
            </div>
          ) : (
            <>
              <p className="text-center text-sm text-gray-300">
                Aligning with <span className="font-semibold text-grow-200">{pickedFaction?.name}</span>{" "}
                — join the waitlist to lock it in.
              </p>

              <div className="flex justify-center">
                <ConnectWalletButton onConnected={(addr) => setAddress(addr)} />
              </div>

              <div className="flex items-center gap-3 text-[10px] uppercase tracking-wide text-gray-600">
                <span className="h-px flex-1 bg-ink-700" /> or paste it <span className="h-px flex-1 bg-ink-700" />
              </div>

              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Algorand address (optional)"
                aria-label="Algorand address"
                className="w-full rounded-md border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:border-grow-600 focus:outline-none"
              />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email (optional)"
                aria-label="Email"
                type="email"
                className="w-full rounded-md border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:border-grow-600 focus:outline-none"
              />

              {error && <p className="text-sm text-red-400">{error}</p>}

              <Button
                className="w-full"
                disabled={join.isPending}
                onClick={() => join.mutate()}
              >
                {join.isPending ? "Joining…" : `Join the waitlist with ${pickedFaction?.name}`}
              </Button>
              <p className="text-center text-[11px] text-gray-600">
                No wallet yet? You can still join with just an email and add a wallet later.
              </p>
            </>
          )}
        </div>
      )}
      </div>
    </>
  );
}

function FactionCard({
  faction,
  selected,
  share,
  onPick,
}: {
  faction: Faction;
  selected: boolean;
  share: number;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      data-reveal
      onClick={onPick}
      aria-pressed={selected}
      className={`flex flex-col gap-2 rounded-2xl border p-4 text-left transition-all ${
        selected ? "scale-[1.02] border-2 bg-ink-800" : "border-ink-700 bg-ink-900/50 hover:bg-ink-800"
      }`}
      style={selected ? { borderColor: faction.color } : undefined}
    >
      <div className="flex items-center justify-between">
        <span className="text-3xl" aria-hidden>
          {faction.crest}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
          style={{ backgroundColor: `${faction.color}22`, color: faction.color }}
        >
          {selected ? "Aligned" : "Choose"}
        </span>
      </div>
      <h3 className="text-lg font-bold text-gray-50">{faction.name}</h3>
      <p className="text-sm text-gray-400">{faction.tagline}</p>
      <p className="text-xs text-gray-500">{faction.lore}</p>
      {/* Live standings meter */}
      <div className="mt-1">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${share}%`, backgroundColor: faction.color }}
          />
        </div>
        <span className="mt-0.5 block text-right text-[10px] tabular-nums text-gray-500">{share}%</span>
      </div>
    </button>
  );
}
