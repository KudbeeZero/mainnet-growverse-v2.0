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
  useLedger,
  useProfile,
} from "@/hooks/queries";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { FEATURES } from "@/lib/features";
import { queryKeys } from "@/lib/queryKeys";
import { grow, dateTime, titleCase } from "@/lib/format";
import type { Badge as BadgeType } from "@/lib/types";

// ---------------------------------------------------------------------------
// Rank card — icon, name, XP progress bar toward next rank level
// ---------------------------------------------------------------------------

function RankCard() {
  const profile = useProfile();
  const level = useLevel();

  const r = profile.data?.rank;
  const lv = profile.data?.level ?? level.data;

  if (!r || !lv) {
    return (
      <Card className="flex animate-pulse flex-col gap-3">
        <div className="h-14 w-full rounded-lg bg-ink-700" />
        <div className="h-4 w-2/3 rounded bg-ink-700" />
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full border-2 border-grow-600 bg-ink-900 text-3xl">
          {r.icon}
        </div>
        <div>
          <div className="text-lg font-bold text-grow-300">{r.name}</div>
          <div className="text-xs text-gray-500">
            Rank {r.index} of 12
            {r.next_level_min && (
              <span className="ml-1 text-gray-600">
                · Lvl {r.next_level_min} for next rank
              </span>
            )}
          </div>
        </div>
      </div>

      <div>
        <div className="mb-1 flex justify-between text-[11px] text-gray-400">
          <span>Level {lv.level}</span>
          <span>{lv.xp_for_next_level.toLocaleString()} XP to next level</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-ink-700">
          <div
            className="h-full rounded-full bg-grow-500 transition-all duration-700"
            style={{ width: `${Math.min(100, lv.progress_pct)}%` }}
          />
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Individual badge tile
// ---------------------------------------------------------------------------

function BadgeTile({ badge }: { badge: BadgeType }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
        badge.earned
          ? "border-grow-700/60 bg-grow-950/30"
          : "border-ink-700 bg-ink-900/40 opacity-50"
      }`}
    >
      <div
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-xl ${
          badge.earned ? "bg-grow-800" : "bg-ink-800"
        }`}
      >
        {badge.earned ? badge.icon : "🔒"}
      </div>
      <div className="min-w-0">
        <div
          className={`text-sm font-semibold ${badge.earned ? "text-gray-100" : "text-gray-500"}`}
        >
          {badge.label}
        </div>
        <div className="truncate text-xs text-gray-500">{badge.description}</div>
        {badge.earned && badge.earned_at && (
          <div className="text-[10px] text-grow-600">{dateTime(badge.earned_at)}</div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Specialization badges section
// ---------------------------------------------------------------------------

function BadgesSection() {
  const profile = useProfile();

  if (profile.isLoading) return <LoadingBlock />;

  const badges = profile.data?.badges ?? [];
  const earned = badges.filter((b) => b.earned);
  const locked = badges.filter((b) => !b.earned);

  return (
    <div className="space-y-4">
      {earned.length > 0 && (
        <div>
          <div className="instrument-label mb-2 text-grow-500">
            EARNED ({earned.length})
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {earned.map((b) => (
              <BadgeTile key={b.key} badge={b} />
            ))}
          </div>
        </div>
      )}

      {locked.length > 0 && (
        <div>
          <div className="instrument-label mb-2 text-gray-600">
            LOCKED ({locked.length})
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {locked.map((b) => (
              <BadgeTile key={b.key} badge={b} />
            ))}
          </div>
        </div>
      )}

      {badges.length === 0 && (
        <p className="text-sm text-gray-500">No badges yet — start growing to unlock them.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Medals section (backed by the profile endpoint's medals array)
// ---------------------------------------------------------------------------

function MedalsSection() {
  const profile = useProfile();
  const { playerId } = useSession();

  const money = [
    queryKeys.wallet(playerId ?? ""),
    queryKeys.player(playerId ?? ""),
    queryKeys.ledger(playerId ?? ""),
  ];

  const claim = useApiMutation(
    (key: string) => api.players.claimAchievement(playerId!, key),
    {
      invalidate: [
        queryKeys.achievements(playerId ?? ""),
        queryKeys.profile(playerId ?? ""),
        ...money,
      ],
      successMessage: "Reward claimed",
    },
  );

  if (profile.isLoading) return <LoadingBlock />;

  const medals = profile.data?.medals ?? [];

  if (medals.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No achievements yet. Harvest your first plant to begin.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {medals.map((a) => (
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
            <Button
              size="sm"
              loading={claim.isPending && claim.variables === a.key}
              onClick={() => claim.mutate(a.key)}
            >
              Claim {grow(a.reward)}
            </Button>
          ) : (
            <Badge className="border-ink-700 bg-ink-800 text-gray-500">Locked</Badge>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main profile page
// ---------------------------------------------------------------------------

function ProfileInner() {
  const { playerId, logout } = useSession();
  const router = useRouter();
  const player = usePlayer();
  const wallet = useWallet();
  const level = useLevel();
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

      {/* ── Row 1: rank, wallet/XP, titles ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <RankCard />

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
            <Button
              className="mt-2"
              size="sm"
              loading={daily.isPending}
              onClick={() => daily.mutate()}
            >
              Claim daily stipend
            </Button>
          </div>
        </Card>

        <Card>
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
                  <Button
                    size="sm"
                    loading={link.isPending}
                    disabled={!addr.trim()}
                    onClick={() => link.mutate()}
                  >
                    Link
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* ── Stake stub ── */}
      <Card className="border-cyan-900/40">
        <CardHeader title="🔒 Stake GROW" subtitle="Lock tokens for a passive daily drip" />
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Staked</span>
            <span className="font-mono font-bold text-gray-200">0 GC</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Daily drip</span>
            <span className="font-mono font-bold text-grow-400">— GC / day</span>
          </div>
          <Button size="sm" disabled className="w-full cursor-not-allowed opacity-50">
            Stake — unlocks after first harvest
          </Button>
        </div>
      </Card>

      {/* ── Specialization badges ── */}
      <Section title="Specialization Badges">
        <BadgesSection />
      </Section>

      {/* ── Medals ── */}
      <Section title="Medals">
        <MedalsSection />
      </Section>

      {/* ── Harvest vault ── */}
      <Section title="Harvest vault">
        <HarvestsPanel />
      </Section>

      {/* ── Ledger ── */}
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
                      <td
                        className={`py-1 pr-2 text-right tabular-nums ${
                          e.amount >= 0 ? "text-grow-300" : "text-red-300"
                        }`}
                      >
                        {e.amount >= 0 ? "+" : ""}
                        {e.amount}
                      </td>
                      <td className="py-1 text-right tabular-nums text-gray-400">
                        {e.balance_after}
                      </td>
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
