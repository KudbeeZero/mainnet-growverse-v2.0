"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LoadingBlock } from "@/components/ui/Spinner";
import { PageHeader, Section } from "@/components/ui/PageHeader";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { TitleBadge } from "@/components/ui/Pills";
import { TextInput } from "@/components/ui/Field";
import { HarvestsPanel } from "@/components/harvest/HarvestsPanel";
import { useApiMutation } from "@/hooks/useApiMutation";
import {
  usePlayer,
  useWallet,
  useLevel,
  useAchievements,
  useLedger,
} from "@/hooks/queries";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { FEATURES } from "@/lib/features";
import { queryKeys } from "@/lib/queryKeys";
import { grow, dateTime, titleCase } from "@/lib/format";

function ProfileInner() {
  const { playerId, logout } = useSession();
  const router = useRouter();
  const player = usePlayer();
  const wallet = useWallet();
  const level = useLevel();
  const achievements = useAchievements();
  const ledger = useLedger();
  const [addr, setAddr] = useState("");

  const money = [
    queryKeys.wallet(playerId ?? ""),
    queryKeys.player(playerId ?? ""),
    queryKeys.ledger(playerId ?? ""),
  ];

  const daily = useApiMutation(() => api.players.claimDaily(playerId!), {
    invalidate: money,
    successMessage: (r) => `Claimed ${grow(r.amount)} daily stipend`,
  });
  const claim = useApiMutation((key: string) => api.players.claimAchievement(playerId!, key), {
    invalidate: [queryKeys.achievements(playerId ?? ""), ...money],
    successMessage: "Reward claimed",
  });
  const link = useApiMutation(() => api.wallet.link(playerId!, addr.trim()), {
    invalidate: [queryKeys.player(playerId ?? "")],
    successMessage: "Algorand wallet linked",
  });

  if (player.isLoading) return <LoadingBlock label="Loading profile…" />;

  const p = player.data;
  const titles = [p?.cannabis_cup_title, p?.university_title].filter(Boolean) as string[];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="GROWER PROFILE"
        title={p?.username ?? "Grower"}
        subtitle={p?.email ?? "No email on file"}
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              logout();
              router.replace("/onboarding");
            }}
          >
            Sign out
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="flex items-center gap-4">
          {level.data && (
            <ProgressRing pct={level.data.progress_pct} size={84}>
              <div className="text-center">
                <div className="instrument-value text-lg text-gray-100">{level.data.level}</div>
                <div className="instrument-label">LEVEL</div>
              </div>
            </ProgressRing>
          )}
          <div>
            <div className="text-3xl font-bold text-grow-300">{grow(wallet.data?.balance)}</div>
            {level.data && (
              <div className="mt-1 text-xs text-gray-500">
                {level.data.xp} XP · {level.data.xp_for_next_level} to next level
              </div>
            )}
            <Button className="mt-2" size="sm" loading={daily.isPending} onClick={() => daily.mutate()}>
              Claim daily stipend
            </Button>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Lifetime titles" subtitle="Earned across the Cup and the University" />
          {titles.length === 0 ? (
            <p className="text-sm text-gray-500">
              No titles yet. Win a Cannabis Cup or earn a degree to claim prestige.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {titles.map((t) => (
                <TitleBadge key={t}>{t}</TitleBadge>
              ))}
            </div>
          )}
          {FEATURES.chain && (
            <div className="mt-4">
              <div className="instrument-label mb-1">ALGORAND WALLET</div>
              {p?.algorand_address ? (
                <code className="block break-all rounded-md border border-ink-600 bg-ink-900 px-3 py-2 text-xs text-gray-300">
                  {p.algorand_address}
                </code>
              ) : (
                <div className="flex gap-2">
                  <TextInput
                    value={addr}
                    onChange={(e) => setAddr(e.target.value)}
                    placeholder="Algorand address"
                    aria-label="Algorand wallet address"
                  />
                  <Button size="sm" loading={link.isPending} disabled={!addr.trim()} onClick={() => link.mutate()}>
                    Link
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      <Section title="Harvest vault">
        <HarvestsPanel />
      </Section>

      <Section title="Achievements">
        {achievements.isLoading ? (
          <LoadingBlock />
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(achievements.data ?? []).map((a) => (
              <div
                key={a.key}
                className="flex items-center justify-between gap-2 rounded-md border border-ink-700 bg-ink-900/50 px-3 py-2"
              >
                <div>
                  <div className="text-sm font-medium text-gray-200">{titleCase(a.key)}</div>
                  <div className="text-xs text-gray-500">{a.description}</div>
                </div>
                {a.claimed ? (
                  <Badge className="border-ink-600 bg-ink-700 text-gray-400">Claimed</Badge>
                ) : a.unlocked ? (
                  <Button size="sm" loading={claim.isPending && claim.variables === a.key} onClick={() => claim.mutate(a.key)}>
                    Claim {grow(a.reward)}
                  </Button>
                ) : (
                  <Badge className="border-ink-700 bg-ink-800 text-gray-500">Locked</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Ledger">
        <Card>
          {ledger.isLoading ? (
            <LoadingBlock />
          ) : (
            <div className="max-h-80 overflow-auto">
              <table className="w-full min-w-[28rem] text-left text-xs">
                <thead className="sticky top-0 bg-ink-800 text-gray-400">
                  <tr>
                    <th className="py-1 pr-2">When</th>
                    <th className="py-1 pr-2">Type</th>
                    <th className="py-1 pr-2 text-right">Amount</th>
                    <th className="py-1 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {(ledger.data ?? []).map((e) => (
                    <tr key={e.id} className="border-t border-ink-700">
                      <td className="py-1 pr-2 text-gray-500">{dateTime(e.created_at)}</td>
                      <td className="py-1 pr-2 text-gray-300">{titleCase(e.entry_type)}</td>
                      <td className={`py-1 pr-2 text-right tabular-nums ${e.amount >= 0 ? "text-grow-300" : "text-red-300"}`}>
                        {e.amount >= 0 ? "+" : ""}
                        {e.amount}
                      </td>
                      <td className="py-1 text-right tabular-nums text-gray-400">{e.balance_after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </Section>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileInner />
    </RequireAuth>
  );
}
