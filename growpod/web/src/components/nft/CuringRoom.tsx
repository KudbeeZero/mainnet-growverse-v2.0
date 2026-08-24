"use client";

// Curing Vault — the staking/curing room, polished.
//
// Locks a minted NFT for a duration to earn a bonus GC reward. This is the
// "staking" half of the NFT lifecycle (the other half is the marketplace). The
// locks query polls every 10s, so the progress rings and live countdowns update
// in real time without a refresh.

import { useMemo } from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LoadingBlock } from "@/components/ui/Spinner";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Countdown } from "@/components/ui/Countdown";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useStakingLocks } from "@/hooks/queries";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { queryKeys } from "@/lib/queryKeys";
import { grow, num } from "@/lib/format";
import type { StakingLock } from "@/lib/types";

export function CuringRoom() {
  const { playerId } = useSession();
  const locks = useStakingLocks();

  const claim = useApiMutation((lockId: string) => api.stakes.claimRewards(playerId!, lockId), {
    invalidate: [
      queryKeys.stakingLocks(playerId ?? ""),
      queryKeys.nftCollection(playerId ?? ""),
      queryKeys.wallet(playerId ?? ""),
      queryKeys.ledger(playerId ?? ""),
    ],
    successMessage: (r) => `Claimed +${grow(parseFloat(r.rewards_claimed))} and returned the NFT`,
  });

  const stats = useMemo(() => {
    const items = (locks.data ?? []) as StakingLock[];
    const active = items.filter((l) => l.status === "active");
    const ready = items.filter((l) => l.can_claim && l.status !== "withdrawn");
    const withdrawn = items.filter((l) => l.status === "withdrawn");
    const pendingReward = active.reduce((sum, l) => sum + parseFloat(l.rewards_amount), 0);
    const readyReward = ready.reduce((sum, l) => sum + parseFloat(l.rewards_amount), 0);
    return { items, active, ready, withdrawn, pendingReward, readyReward };
  }, [locks.data]);

  if (locks.isLoading) {
    return <LoadingBlock label="Loading curing vault…" />;
  }

  if (stats.items.length === 0) {
    return (
      <Card>
        <div className="py-10 text-center">
          <div className="mb-3 text-5xl">🧪</div>
          <p className="text-sm font-semibold text-gray-200">Your curing vault is empty</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-gray-500">
            Lock a minted NFT here to earn a bonus GC reward over time. The rarer the harvest, the bigger the bonus.
          </p>
          <Link
            href="/nft-center?tab=collection"
            className="mt-4 inline-flex rounded-md border border-purple-500/40 bg-purple-500/10 px-4 py-2 text-xs font-semibold text-purple-200 hover:bg-purple-500/20"
          >
            ← Stake an NFT from your collection
          </Link>
        </div>
      </Card>
    );
  }

  const renderLock = (lock: StakingLock) => {
    const isReady = lock.can_claim && lock.status !== "withdrawn";
    const timeRemainingHours = Math.ceil(lock.time_remaining_seconds / 3600);
    const daysRemaining = Math.ceil(timeRemainingHours / 24);

    return (
      <div
        key={lock.lock_id}
        className={`rounded-xl border p-4 ${
          isReady
            ? "border-green-700/60 bg-green-900/10"
            : lock.status === "withdrawn"
              ? "border-ink-700 bg-ink-900/40 opacity-70"
              : "border-purple-700/50 bg-purple-900/10"
        }`}
      >
        <div className="mb-3 flex items-start justify-between">
          <div>
            <div className="text-sm font-bold text-gray-200">NFT #{lock.asset_id}</div>
            <div className="mt-0.5 text-[10px] text-gray-500">Lock {lock.lock_id.slice(0, 8)}…</div>
          </div>
          <Badge
            className={
              isReady
                ? "border-green-600 bg-green-900/60 text-green-200"
                : lock.status === "withdrawn"
                  ? "border-ink-600 bg-ink-700 text-gray-400"
                  : "border-purple-700 bg-purple-900/60 text-purple-100"
            }
          >
            {isReady ? "✅ Ready to claim" : lock.status === "withdrawn" ? "🗒 Claimed" : "🔒 Curing"}
          </Badge>
        </div>

        {lock.status === "active" && (
          <div className="mb-3 flex items-center gap-4">
            <ProgressRing pct={lock.progress_pct} size={64} color="#a855f7">
              <div className="text-center">
                <div className="text-xs font-bold text-gray-100">{Math.round(lock.progress_pct)}%</div>
                <div className="text-[8px] text-gray-400">cured</div>
              </div>
            </ProgressRing>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-wide text-gray-500">Time remaining</div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold text-grow-300">
                  {daysRemaining} day{daysRemaining !== 1 ? "s" : ""}
                </span>
                {lock.time_remaining_seconds > 0 && (
                  <Countdown to={lock.cure_ends_at} className="text-xs text-gray-400" />
                )}
              </div>
              <div className="mt-0.5 text-[10px] text-gray-500">
                Completes {new Date(lock.cure_ends_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        )}

        <div className="rounded-lg bg-ink-800/60 p-2.5">
          <div className="text-[10px] uppercase tracking-wide text-gray-500">
            {isReady ? "Claimable bonus" : "Post-cure bonus"}
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-sm font-bold text-grow-300">
              +{grow(parseFloat(lock.rewards_amount))} GC
            </span>
            {lock.status === "active" && (
              <span className="text-[10px] text-gray-500">
                {num(parseFloat(lock.rewards_amount) / Math.max(1, daysRemaining), 2)} GC/day
              </span>
            )}
          </div>
        </div>

        {isReady && (
          <Button
            size="sm"
            className="mt-3 w-full"
            loading={claim.isPending && claim.variables === lock.lock_id}
            onClick={() => claim.mutate(lock.lock_id)}
          >
            🎁 Claim {grow(parseFloat(lock.rewards_amount))} + NFT
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Summary dashboard */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Curing" value={stats.active.length} icon="🔒" accent="purple" />
        <Stat label="Ready" value={stats.ready.length} icon="✅" accent="green" />
        <Stat
          label="Pending rewards"
          value={`${grow(stats.pendingReward + stats.readyReward)} GC`}
          icon="💰"
          accent="cyan"
        />
      </div>

      {stats.active.length > 0 && (
        <div>
          <div className="instrument-label mb-2 text-purple-400">
            CURRENTLY CURING ({stats.active.length})
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {stats.active.map(renderLock)}
          </div>
        </div>
      )}

      {stats.ready.length > 0 && (
        <div>
          <div className="instrument-label mb-2 text-green-400">
            READY TO CLAIM ({stats.ready.length})
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {stats.ready.map(renderLock)}
          </div>
        </div>
      )}

      {stats.withdrawn.length > 0 && (
        <details>
          <summary className="instrument-label mb-2 cursor-pointer text-gray-500">
            COMPLETED ({stats.withdrawn.length})
          </summary>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {stats.withdrawn.map(renderLock)}
          </div>
        </details>
      )}

      <Card className="border-purple-700/40 bg-purple-900/20">
        <CardHeader title="💡 How Curing Works" />
        <div className="space-y-1 text-sm text-gray-400">
          <p>1. Lock a minted NFT in the curing room</p>
          <p>2. Wait for the cure duration (default 7 days)</p>
          <p>3. Earn a bonus based on the harvest&apos;s appraised value</p>
          <p>4. Claim your NFT + bonus GC when ready</p>
        </div>
        <p className="mt-3 border-t border-purple-700/30 pt-2 text-[11px] text-gray-500">
          Curing is a cosmetic in-game bonus with no real-world value. It isn&apos;t an investment, and GC/NFTs
          earned have no cash-out guarantee outside the game.
        </p>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: string;
  accent: "purple" | "green" | "cyan";
}) {
  const ring = {
    purple: "border-purple-700/50 bg-purple-900/10",
    green: "border-green-700/50 bg-green-900/10",
    cyan: "border-cyan-700/50 bg-cyan-900/10",
  }[accent];
  return (
    <div className={`rounded-lg border p-2.5 text-center ${ring}`}>
      <div className="text-lg" aria-hidden>
        {icon}
      </div>
      <div className="text-sm font-bold text-gray-100">{value}</div>
      <div className="text-[10px] text-gray-500">{label}</div>
    </div>
  );
}
