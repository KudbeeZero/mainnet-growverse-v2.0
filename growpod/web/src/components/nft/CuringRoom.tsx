"use client";

import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LoadingBlock } from "@/components/ui/Spinner";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useStakingLocks } from "@/hooks/queries";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { queryKeys } from "@/lib/queryKeys";
import { grow } from "@/lib/format";
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

  if (locks.isLoading) {
    return <LoadingBlock label="Loading curing room…" />;
  }

  const items = (locks.data ?? []) as StakingLock[];

  if (items.length === 0) {
    return (
      <Card>
        <div className="text-center py-8">
          <div className="text-5xl mb-3">🌿</div>
          <p className="text-sm text-gray-400">
            No NFTs curing yet. Lock a harvest to earn bonus rewards!
          </p>
        </div>
      </Card>
    );
  }

  const active = items.filter((l) => l.status === "active");
  const ready = items.filter((l) => l.status === "complete" || l.can_claim);
  const withdrawn = items.filter((l) => l.status === "withdrawn");

  const renderLock = (lock: StakingLock) => {
    const timeRemainingHours = Math.ceil(lock.time_remaining_seconds / 3600);
    const daysRemaining = Math.ceil(timeRemainingHours / 24);

    return (
      <div
        key={lock.lock_id}
        className="rounded-lg border border-ink-700 bg-ink-900/50 p-4"
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-sm font-bold text-gray-200">
              NFT #{lock.asset_id}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              Lock ID: {lock.lock_id.slice(0, 8)}…
            </div>
          </div>
          <Badge
            className={
              lock.status === "active"
                ? "bg-purple-900 border-purple-700"
                : "bg-green-900 border-green-700"
            }
          >
            {lock.status === "active" ? "🔒 Curing" : "✅ Ready"}
          </Badge>
        </div>

        {lock.status === "active" && (
          <div className="flex items-center gap-4 mb-3">
            <ProgressRing pct={lock.progress_pct} size={60}>
              <div className="text-center">
                <div className="text-xs font-bold text-gray-100">
                  {Math.round(lock.progress_pct)}%
                </div>
              </div>
            </ProgressRing>
            <div>
              <div className="text-xs text-gray-400">Time remaining</div>
              <div className="text-lg font-bold text-grow-300">
                {daysRemaining} day{daysRemaining !== 1 ? "s" : ""}
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">
                Completes {new Date(lock.cure_ends_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        )}

        <div className="bg-ink-800/50 rounded p-2 mb-3">
          <div className="text-[10px] text-gray-500">Post-cure bonus</div>
          <div className="text-sm font-mono text-grow-300">
            +{grow(parseFloat(lock.rewards_amount))} GC
          </div>
        </div>

        {lock.can_claim && lock.status !== "withdrawn" && (
          <Button
            size="sm"
            className="w-full"
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
      {active.length > 0 && (
        <div>
          <div className="instrument-label mb-2 text-purple-500">
            CURRENTLY CURING ({active.length})
          </div>
          <div className="space-y-2">
            {active.map(renderLock)}
          </div>
        </div>
      )}

      {ready.length > 0 && (
        <div>
          <div className="instrument-label mb-2 text-green-500">
            READY TO CLAIM ({ready.length})
          </div>
          <div className="space-y-2">
            {ready.map(renderLock)}
          </div>
        </div>
      )}

      {withdrawn.length > 0 && (
        <details>
          <summary className="instrument-label mb-2 text-gray-500 cursor-pointer">
            COMPLETED ({withdrawn.length})
          </summary>
          <div className="space-y-2 mt-2">
            {withdrawn.map(renderLock)}
          </div>
        </details>
      )}

      <Card className="border-purple-700/40 bg-purple-900/20">
        <CardHeader title="💡 How Curing Works" />
        <div className="space-y-1 text-sm text-gray-400">
          <p>1. Lock a minted NFT harvest in the curing room</p>
          <p>2. Wait for the cure duration (default 7 days)</p>
          <p>3. Earn a bonus % of the harvest&apos;s sale value</p>
          <p>4. Claim your NFT + bonus GC when ready</p>
        </div>
      </Card>
    </div>
  );
}
