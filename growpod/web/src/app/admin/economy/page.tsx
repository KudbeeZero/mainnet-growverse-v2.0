"use client";

import { useState, useEffect, useCallback } from "react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiFetch } from "@/lib/api/client";

// ---- shared helpers --------------------------------------------------------

function slider(
  label: string,
  value: number,
  setValue: (v: number) => void,
  min: number,
  max: number,
  step: number,
  format?: (v: number) => string,
) {
  const fmt = format ?? ((v) => String(v));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">{label}</span>
        <span className="font-mono text-grow-300">{fmt(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="w-full accent-grow-500"
      />
      <div className="flex justify-between text-[10px] text-gray-600">
        <span>{fmt(min)}</span>
        <span>{fmt(max)}</span>
      </div>
    </div>
  );
}

function gcFmt(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M GC`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K GC`;
  return `${v.toFixed(0)} GC`;
}

// ---- Types -----------------------------------------------------------------

interface DailyEntry {
  date: string;
  minted: number;
  burned: number;
  seasonal_sink: number;
  supply_delta: number;
}

interface LedgerSummary {
  days: number;
  daily: DailyEntry[];
  totals: { minted: number; burned: number; seasonal_sink: number };
  money_supply: number;
  active_players: number;
  period_gc: {
    harvest: number;
    stipend: number;
    seed_purchases: number;
    tuition: number;
    seasonal: number;
  };
}

// ---- SVG Line Chart --------------------------------------------------------

interface ChartSeries {
  key: keyof DailyEntry;
  color: string;
  label: string;
}

function LineChart({
  data,
  series,
  height = 140,
}: {
  data: DailyEntry[];
  series: ChartSeries[];
  height?: number;
}) {
  const width = 800;
  const padX = 8;
  const padY = 12;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const allValues = data.flatMap((d) => series.map((s) => d[s.key] as number));
  const maxVal = Math.max(...allValues, 1);
  const minVal = Math.min(...allValues, 0);
  const range = maxVal - minVal || 1;

  function toX(i: number) {
    return padX + (i / Math.max(data.length - 1, 1)) * innerW;
  }
  function toY(v: number) {
    return padY + (1 - (v - minVal) / range) * innerH;
  }

  function makePath(key: keyof DailyEntry) {
    if (data.length === 0) return "";
    return data
      .map((d, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(d[key] as number).toFixed(1)}`)
      .join(" ");
  }

  const tickCount = 4;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) =>
    minVal + (i / tickCount) * range,
  );

  const xTickEvery = Math.max(1, Math.floor(data.length / 6));
  const xTicks = data.filter((_, i) => i % xTickEvery === 0 || i === data.length - 1);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ minWidth: "320px", display: "block" }}
      >
        {yTicks.map((v, i) => {
          const y = toY(v);
          return (
            <g key={i}>
              <line x1={padX} y1={y} x2={width - padX} y2={y} stroke="#2d2d2d" strokeWidth="0.5" />
              <text x={padX} y={y - 2} fill="#4b5563" fontSize="8" textAnchor="start">
                {gcFmt(v)}
              </text>
            </g>
          );
        })}
        {xTicks.map((d, i) => {
          const idx = data.indexOf(d);
          const x = toX(idx);
          return (
            <text key={i} x={x} y={height - 1} fill="#4b5563" fontSize="8" textAnchor="middle">
              {d.date.slice(5)}
            </text>
          );
        })}
        {series.map((s) => (
          <path
            key={s.key}
            d={makePath(s.key)}
            fill="none"
            stroke={s.color}
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity="0.85"
          />
        ))}
      </svg>
    </div>
  );
}

function AreaChart({
  data,
  valueKey,
  color,
  height = 100,
}: {
  data: DailyEntry[];
  valueKey: keyof DailyEntry;
  color: string;
  height?: number;
}) {
  const width = 800;
  const padX = 8;
  const padY = 12;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const values = data.map((d) => d[valueKey] as number);
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values, 0);
  const range = maxVal - minVal || 1;

  function toX(i: number) {
    return padX + (i / Math.max(data.length - 1, 1)) * innerW;
  }
  function toY(v: number) {
    return padY + (1 - (v - minVal) / range) * innerH;
  }
  const zeroY = toY(0);

  const linePts = data.map((d, i) => `${toX(i).toFixed(1)},${toY(d[valueKey] as number).toFixed(1)}`);
  const areaPath =
    data.length > 0
      ? `M${toX(0).toFixed(1)},${zeroY.toFixed(1)} ` +
        linePts.map((p, i) => `${i === 0 ? "L" : "L"}${p}`).join(" ") +
        ` L${toX(data.length - 1).toFixed(1)},${zeroY.toFixed(1)} Z`
      : "";

  const linePath =
    data.length > 0 ? linePts.map((p, i) => `${i === 0 ? "M" : "L"}${p}`).join(" ") : "";

  const xTickEvery = Math.max(1, Math.floor(data.length / 6));
  const xTicks = data.filter((_, i) => i % xTickEvery === 0 || i === data.length - 1);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ minWidth: "320px", display: "block" }}
      >
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <line x1={padX} y1={zeroY} x2={width - padX} y2={zeroY} stroke="#374151" strokeWidth="0.5" strokeDasharray="3,2" />
        {xTicks.map((d, i) => {
          const idx = data.indexOf(d);
          const x = toX(idx);
          return (
            <text key={i} x={x} y={height - 1} fill="#4b5563" fontSize="8" textAnchor="middle">
              {d.date.slice(5)}
            </text>
          );
        })}
        <path d={areaPath} fill="url(#areaGrad)" />
        <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// ---- Live Snapshot card ----------------------------------------------------

function LiveSnapshotCard({ onSeed }: { onSeed: (data: LedgerSummary) => void }) {
  const [summary, setSummary] = useState<LedgerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch<LedgerSummary>("/admin/economy/ledger-summary", { auth: true })
      .then((data) => {
        if (!cancelled) {
          setSummary(data);
          onSeed(data);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load ledger summary");
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [onSeed]);

  if (loading) {
    return (
      <Card>
        <CardHeader title="Live 30-Day Token Flow" />
        <p className="text-sm text-gray-500 py-4">Loading real ledger data…</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader title="Live 30-Day Token Flow" />
        <p className="text-sm text-red-400">{error}</p>
      </Card>
    );
  }

  if (!summary) return null;

  const { daily, totals, money_supply, active_players } = summary;

  const netFlow = totals.minted - totals.burned;
  const netPct = totals.minted > 0 ? (netFlow / totals.minted) * 100 : 0;

  const flowSeries: ChartSeries[] = [
    { key: "minted", color: "#4ade80", label: "Minted (faucets)" },
    { key: "burned", color: "#f87171", label: "Burned (sinks)" },
    { key: "seasonal_sink", color: "#a78bfa", label: "Seasonal sink" },
  ];

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <CardHeader title="Live 30-Day Token Flow" />
        <button
          onClick={() => onSeed(summary)}
          className="shrink-0 rounded bg-grow-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-grow-600"
          title="Re-seed the projector sliders from current live data"
        >
          Re-seed from live data ↓
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-5">
        <MetricBox label="Active players" value={active_players.toLocaleString()} sub="ever" />
        <MetricBox label="Money supply" value={gcFmt(money_supply)} sub="all wallets" />
        <MetricBox
          label="30-day minted"
          value={gcFmt(totals.minted)}
          sub="faucets"
          highlight="green"
        />
        <MetricBox
          label="30-day burned"
          value={gcFmt(totals.burned)}
          sub={`incl. ${gcFmt(totals.seasonal_sink)} seasonal`}
          highlight={netFlow > 0 ? "red" : "yellow"}
        />
      </div>

      <div className="mb-1 flex items-center gap-4 flex-wrap">
        <span className="text-[10px] uppercase tracking-widest text-gray-500">Daily flow — GC minted vs burned</span>
        <div className="flex gap-4">
          {flowSeries.map((s) => (
            <span key={s.key} className="flex items-center gap-1 text-[10px] text-gray-400">
              <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      </div>
      <LineChart data={daily} series={flowSeries} height={140} />

      <div className="mt-5 mb-1">
        <span className="text-[10px] uppercase tracking-widest text-gray-500">
          Cumulative net supply delta (minted − burned)
          <span className={`ml-2 font-mono ${netFlow >= 0 ? "text-red-400" : "text-grow-400"}`}>
            {netFlow >= 0 ? "+" : ""}{gcFmt(netFlow)} ({netPct >= 0 ? "+" : ""}{netPct.toFixed(1)}%)
          </span>
        </span>
      </div>
      <AreaChart data={daily} valueKey="supply_delta" color={netFlow >= 0 ? "#f87171" : "#4ade80"} height={100} />

      {totals.seasonal_sink > 0 && (
        <>
          <div className="mt-5 mb-1">
            <span className="text-[10px] uppercase tracking-widest text-gray-500">
              Seasonal strain sink — daily GC burned via exclusive drops
            </span>
          </div>
          <AreaChart data={daily} valueKey="seasonal_sink" color="#a78bfa" height={80} />
        </>
      )}
    </Card>
  );
}

// ---- Economy Projector -----------------------------------------------------

interface ProjectorSeeds {
  players: number;
  gcPerHarvest: number;
  dailyBonusGc: number;
  seedCostAvg: number;
  tuitionAvgMonthly: number;
  premiumStrainPrice: number;
  premiumPurchaseRate: number;
}

function deriveSeeds(summary: LedgerSummary): ProjectorSeeds {
  const { active_players, period_gc } = summary;
  const players = Math.max(active_players, 1);

  const gcPerHarvest =
    period_gc.harvest > 0
      ? Math.round(period_gc.harvest / Math.max(players, 1))
      : 80;

  const dailyBonusGc =
    period_gc.stipend > 0
      ? Math.round(period_gc.stipend / Math.max(players * 30, 1))
      : 10;

  const seedCostAvg =
    period_gc.seed_purchases > 0
      ? Math.round(period_gc.seed_purchases / Math.max(players, 1))
      : 40;

  const tuitionAvgMonthly =
    period_gc.tuition > 0
      ? Math.round(period_gc.tuition / Math.max(players, 1))
      : 25;

  const premiumStrainPrice =
    period_gc.seasonal > 0 && players > 0
      ? Math.max(50, Math.round(period_gc.seasonal / Math.max(players * 0.05, 1)))
      : 250;

  const premiumPurchaseRate =
    period_gc.seasonal > 0 && period_gc.seed_purchases > 0
      ? Math.min(0.5, period_gc.seasonal / Math.max(period_gc.seed_purchases + period_gc.seasonal, 1))
      : 0.05;

  return {
    players,
    gcPerHarvest: Math.min(Math.max(gcPerHarvest, 10), 500),
    dailyBonusGc: Math.min(Math.max(dailyBonusGc, 0), 50),
    seedCostAvg: Math.min(Math.max(seedCostAvg, 10), 500),
    tuitionAvgMonthly: Math.min(Math.max(tuitionAvgMonthly, 0), 200),
    premiumStrainPrice: Math.min(Math.max(premiumStrainPrice, 50), 2000),
    premiumPurchaseRate: Math.min(Math.max(premiumPurchaseRate, 0), 0.5),
  };
}

function EconomyProjectorInner({ seeds }: { seeds?: ProjectorSeeds }) {
  const [players, setPlayers] = useState(seeds?.players ?? 500);
  const [growCyclesPerMonth, setGrowCyclesPerMonth] = useState(4);
  const [gcPerHarvest, setGcPerHarvest] = useState(seeds?.gcPerHarvest ?? 80);
  const [dailyBonusGc, setDailyBonusGc] = useState(seeds?.dailyBonusGc ?? 10);
  const [seedCostAvg, setSeedCostAvg] = useState(seeds?.seedCostAvg ?? 40);
  const [tuitionAvgMonthly, setTuitionAvgMonthly] = useState(seeds?.tuitionAvgMonthly ?? 25);
  const [premiumStrainPrice, setPremiumStrainPrice] = useState(seeds?.premiumStrainPrice ?? 250);
  const [premiumPurchaseRate, setPremiumPurchaseRate] = useState(seeds?.premiumPurchaseRate ?? 0.05);

  const [seededFrom, setSeededFrom] = useState<string | null>(null);

  useEffect(() => {
    if (!seeds) return;
    setPlayers(seeds.players);
    setGcPerHarvest(seeds.gcPerHarvest);
    setDailyBonusGc(seeds.dailyBonusGc);
    setSeedCostAvg(seeds.seedCostAvg);
    setTuitionAvgMonthly(seeds.tuitionAvgMonthly);
    setPremiumStrainPrice(seeds.premiumStrainPrice);
    setPremiumPurchaseRate(seeds.premiumPurchaseRate);
    setSeededFrom("real player data");
  }, [seeds]);

  const harvestFaucet = players * growCyclesPerMonth * gcPerHarvest;
  const bonusFaucet = players * dailyBonusGc * 30;
  const totalFaucet = harvestFaucet + bonusFaucet;

  const seedSink = players * growCyclesPerMonth * seedCostAvg;
  const tuitionSink = players * tuitionAvgMonthly;
  const premiumSink = players * premiumPurchaseRate * premiumStrainPrice;
  const totalSink = seedSink + tuitionSink + premiumSink;

  const netDelta = totalFaucet - totalSink;
  const netPct = totalFaucet > 0 ? (netDelta / totalFaucet) * 100 : 0;
  const isInflating = netDelta > 0 && netPct > 20;
  const isDeflating = netDelta < 0 && Math.abs(netPct) > 20;

  const sinkRatio = totalFaucet > 0 ? (totalSink / totalFaucet) * 100 : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ADMIN · ECONOMY"
        title="Token Economy Projector"
        subtitle="Model monthly GC issuance vs sinks at scale. Inflation warning fires when faucets exceed sinks by > 20%."
      />

      {seededFrom && (
        <div className="rounded-lg border border-grow-700/50 bg-grow-950/40 px-4 py-2 text-xs text-grow-300">
          ✦ Sliders seeded from <strong>{seededFrom}</strong> — adjust freely to model future scenarios.
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Faucet inputs" />
          <div className="space-y-5">
            {slider("Active players", players, setPlayers, 10, 5000, 10, (v) => v.toLocaleString())}
            {slider("Grow cycles / player / month", growCyclesPerMonth, setGrowCyclesPerMonth, 1, 20, 1)}
            {slider("GC per harvest (avg)", gcPerHarvest, setGcPerHarvest, 10, 500, 5, gcFmt)}
            {slider("Daily login bonus (GC)", dailyBonusGc, setDailyBonusGc, 0, 50, 1, gcFmt)}
          </div>
        </Card>

        <Card>
          <CardHeader title="Sink inputs" />
          <div className="space-y-5">
            {slider("Avg seed cost per grow (GC)", seedCostAvg, setSeedCostAvg, 10, 500, 5, gcFmt)}
            {slider("Avg monthly tuition per player (GC)", tuitionAvgMonthly, setTuitionAvgMonthly, 0, 200, 5, gcFmt)}
            {slider("Premium / seasonal strain price (GC)", premiumStrainPrice, setPremiumStrainPrice, 50, 2000, 25, gcFmt)}
            {slider(
              "Premium purchase rate (% of players/month)",
              premiumPurchaseRate * 100,
              (v) => setPremiumPurchaseRate(v / 100),
              0,
              50,
              0.5,
              (v) => `${v.toFixed(1)}%`,
            )}
          </div>
        </Card>
      </div>

      {isInflating && (
        <div className="rounded-lg border border-red-500/50 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          ⚠️ <strong>Inflation risk:</strong> faucets outpace sinks by{" "}
          <span className="font-mono">{netPct.toFixed(1)}%</span>. Consider raising
          seed/tuition costs, adding new sinks, or reducing harvest payouts.
        </div>
      )}
      {isDeflating && (
        <div className="rounded-lg border border-yellow-500/50 bg-yellow-950/40 px-4 py-3 text-sm text-yellow-300">
          ⚠️ <strong>Deflation risk:</strong> sinks exceed faucets by{" "}
          <span className="font-mono">{Math.abs(netPct).toFixed(1)}%</span>. Players
          may run out of GC; consider increasing harvest payouts or reducing costs.
        </div>
      )}
      {!isInflating && !isDeflating && (
        <div className="rounded-lg border border-grow-700/50 bg-grow-950/40 px-4 py-3 text-sm text-grow-300">
          ✓ Economy is balanced — sink/faucet ratio is within the ±20% healthy band.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricBox label="Monthly faucet" value={gcFmt(totalFaucet)} sub="harvest + bonus" />
        <MetricBox label="Monthly sink" value={gcFmt(totalSink)} sub="seeds + tuition + premium" />
        <MetricBox
          label="Net GC delta"
          value={`${netDelta >= 0 ? "+" : ""}${gcFmt(netDelta)}`}
          sub={`${netPct.toFixed(1)}% of faucet`}
          highlight={isInflating ? "red" : isDeflating ? "yellow" : "green"}
        />
        <MetricBox
          label="Sink ratio"
          value={`${sinkRatio.toFixed(1)}%`}
          sub="sinks / faucet"
          highlight={sinkRatio >= 80 && sinkRatio <= 120 ? "green" : "yellow"}
        />
      </div>

      <Card>
        <CardHeader title="Breakdown" />
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-700 text-left text-xs text-gray-500">
              <th className="pb-2 pr-4">Line item</th>
              <th className="pb-2 pr-4 text-right">Monthly GC</th>
              <th className="pb-2 text-right">% of faucet</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800">
            <TableRow label="Harvest payouts" value={harvestFaucet} total={totalFaucet} type="faucet" />
            <TableRow label="Daily bonuses" value={bonusFaucet} total={totalFaucet} type="faucet" />
            <TableRow label="Seed purchases" value={seedSink} total={totalFaucet} type="sink" />
            <TableRow label="Tuition payments" value={tuitionSink} total={totalFaucet} type="sink" />
            <TableRow label="Seasonal strain drops" value={premiumSink} total={totalFaucet} type="sink" />
          </tbody>
          <tfoot>
            <tr className="border-t border-ink-600 font-semibold">
              <td className="pt-2 pr-4 text-gray-300">Net monthly delta</td>
              <td className={`pt-2 pr-4 text-right font-mono ${netDelta >= 0 ? "text-red-400" : "text-grow-300"}`}>
                {netDelta >= 0 ? "+" : ""}{gcFmt(netDelta)}
              </td>
              <td className="pt-2 text-right text-gray-400">{netPct.toFixed(1)}%</td>
            </tr>
          </tfoot>
        </table>
      </Card>
    </div>
  );
}

// ---- Seasonal Drops management card ----------------------------------------

interface SeasonalEntry {
  id: string;
  strain_id: string;
  strain_name: string;
  strain_rarity: string;
  available_month: string;
  price_gc: number;
  auto_renew: boolean;
  is_current: boolean;
}

interface StrainOption {
  id: string;
  name: string;
  rarity: string;
}

function rarityColor(rarity: string) {
  if (rarity === "legendary") return "text-yellow-400";
  if (rarity === "epic") return "text-purple-400";
  if (rarity === "rare") return "text-blue-400";
  return "text-gray-400";
}

function currentMonthDefault() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function SeasonalDropsCard() {
  const [entries, setEntries] = useState<SeasonalEntry[]>([]);
  const [strainOptions, setStrainOptions] = useState<StrainOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formStrainId, setFormStrainId] = useState("");
  const [formMonth, setFormMonth] = useState(currentMonthDefault());
  const [formPrice, setFormPrice] = useState(250);
  const [formAutoRenew, setFormAutoRenew] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);

  const [rolloverLoading, setRolloverLoading] = useState(false);
  const [rolloverMsg, setRolloverMsg] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ strains: SeasonalEntry[] }>(
        "/admin/seasonal/strains",
        { auth: true },
      );
      setEntries(data.strains);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load seasonal drops");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStrains = useCallback(async () => {
    try {
      const data = await apiFetch<StrainOption[]>("/strains?catalog_only=true");
      setStrainOptions(data);
      if (data.length > 0 && !formStrainId) setFormStrainId(data[0].id);
    } catch {
      // non-fatal — the ID text field is still editable
    }
  }, [formStrainId]);

  useEffect(() => {
    loadEntries();
    loadStrains();
  }, [loadEntries, loadStrains]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormSaving(true);
    try {
      await apiFetch("/admin/seasonal/strains", {
        method: "POST",
        body: {
          strain_id: formStrainId,
          available_month: formMonth,
          price_gc: formPrice,
          auto_renew: formAutoRenew,
        },
      });
      await loadEntries();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setFormSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this seasonal entry?")) return;
    try {
      await apiFetch(`/admin/seasonal/strains/${id}`, { method: "DELETE" });
      setEntries((prev) => prev.filter((r) => r.id !== id));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function handleRollover() {
    setRolloverLoading(true);
    setRolloverMsg(null);
    try {
      const data = await apiFetch<{ count: number }>("/admin/seasonal/strains/rollover", {
        method: "POST",
      });
      setRolloverMsg(
        data.count > 0
          ? `Rolled over ${data.count} strain${data.count !== 1 ? "s" : ""} into next month.`
          : "No auto-renew strains found for this month.",
      );
      await loadEntries();
    } catch (e: unknown) {
      setRolloverMsg(e instanceof Error ? e.message : "Rollover failed");
    } finally {
      setRolloverLoading(false);
    }
  }

  const currentMonth = currentMonthDefault();

  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardHeader title="Seasonal Drops" />
        <button
          onClick={handleRollover}
          disabled={rolloverLoading}
          className="rounded bg-grow-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-grow-600 disabled:opacity-50"
        >
          {rolloverLoading ? "Rolling…" : "Roll → Next Month"}
        </button>
      </div>

      {rolloverMsg && (
        <div className="mb-3 rounded border border-grow-700/50 bg-grow-950/40 px-3 py-2 text-xs text-grow-300">
          {rolloverMsg}
        </div>
      )}

      <form onSubmit={handleAdd} className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-widest text-gray-500">Strain</label>
          {strainOptions.length > 0 ? (
            <select
              value={formStrainId}
              onChange={(e) => setFormStrainId(e.target.value)}
              className="rounded border border-ink-700 bg-ink-900 px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-grow-500"
              required
            >
              {strainOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.rarity})
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              placeholder="strain UUID"
              value={formStrainId}
              onChange={(e) => setFormStrainId(e.target.value)}
              className="rounded border border-ink-700 bg-ink-900 px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-grow-500"
              required
            />
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-widest text-gray-500">Month (YYYY-MM)</label>
          <input
            type="month"
            value={formMonth}
            onChange={(e) => setFormMonth(e.target.value)}
            className="rounded border border-ink-700 bg-ink-900 px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-grow-500"
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-widest text-gray-500">
            Price (GC)
          </label>
          <input
            type="number"
            min={1}
            step={1}
            value={formPrice}
            onChange={(e) => setFormPrice(Number(e.target.value))}
            className="rounded border border-ink-700 bg-ink-900 px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-grow-500"
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-widest text-gray-500">Options</label>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={formAutoRenew}
                onChange={(e) => setFormAutoRenew(e.target.checked)}
                className="accent-grow-500"
              />
              Auto-renew next month
            </label>
            <button
              type="submit"
              disabled={formSaving}
              className="rounded bg-grow-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-grow-600 disabled:opacity-50"
            >
              {formSaving ? "Saving…" : "Add / Update"}
            </button>
          </div>
        </div>

        {formError && (
          <p className="col-span-full text-xs text-red-400">{formError}</p>
        )}
      </form>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-gray-500">No seasonal drops configured yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-700 text-left text-xs text-gray-500">
                <th className="pb-2 pr-4">Strain</th>
                <th className="pb-2 pr-4">Month</th>
                <th className="pb-2 pr-4 text-right">Price</th>
                <th className="pb-2 pr-4 text-center">Auto-renew</th>
                <th className="pb-2 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {entries.map((entry) => (
                <tr key={entry.id} className={entry.is_current ? "bg-grow-950/20" : ""}>
                  <td className="py-2 pr-4">
                    <span className="text-gray-200">{entry.strain_name}</span>
                    <span className={`ml-2 text-[10px] uppercase ${rarityColor(entry.strain_rarity)}`}>
                      {entry.strain_rarity}
                    </span>
                  </td>
                  <td className="py-2 pr-4 font-mono text-gray-400">
                    {entry.available_month}
                    {entry.available_month === currentMonth && (
                      <span className="ml-1.5 rounded bg-grow-800 px-1 py-0.5 text-[9px] uppercase text-grow-300">
                        current
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono text-gray-300">
                    {gcFmt(entry.price_gc)}
                  </td>
                  <td className="py-2 pr-4 text-center">
                    {entry.auto_renew ? (
                      <span className="text-grow-400">✓</span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="text-xs text-red-500 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ---- Shared sub-components -------------------------------------------------

function MetricBox({
  label, value, sub, highlight,
}: {
  label: string;
  value: string;
  sub: string;
  highlight?: "green" | "red" | "yellow";
}) {
  const colorMap = {
    green: "border-grow-700 bg-grow-950/50 text-grow-200",
    red: "border-red-700 bg-red-950/50 text-red-200",
    yellow: "border-yellow-700 bg-yellow-950/50 text-yellow-200",
  };
  const cls = highlight ? colorMap[highlight] : "border-ink-700 bg-ink-900/50 text-gray-200";
  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <div className="text-[10px] uppercase tracking-widest text-current opacity-70">{label}</div>
      <div className="mt-1 font-mono text-lg font-bold">{value}</div>
      <div className="text-[10px] opacity-60">{sub}</div>
    </div>
  );
}

function TableRow({
  label, value, total, type,
}: {
  label: string;
  value: number;
  total: number;
  type: "faucet" | "sink";
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <tr>
      <td className="py-1.5 pr-4 text-gray-300">
        <span className={`mr-1.5 text-[10px] ${type === "faucet" ? "text-grow-400" : "text-red-400"}`}>
          {type === "faucet" ? "▲" : "▼"}
        </span>
        {label}
      </td>
      <td className="py-1.5 pr-4 text-right font-mono text-gray-300">{gcFmt(value)}</td>
      <td className="py-1.5 text-right text-gray-500">{pct.toFixed(1)}%</td>
    </tr>
  );
}

// ---- Store Partners admin card ---------------------------------------------

interface PartnerRow {
  id: string;
  name: string;
  logo_url: string;
  tagline: string;
  product_type: string;
  product_id: string;
  product_name?: string;
  price_gc: number;
  display_order: number;
  active: boolean;
}

function StorePartnersCard() {
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fName, setFName] = useState("");
  const [fLogo, setFLogo] = useState("");
  const [fTagline, setFTagline] = useState("");
  const [fProductType, setFProductType] = useState<"strain" | "consumable">("consumable");
  const [fProductId, setFProductId] = useState("");
  const [fPrice, setFPrice] = useState(100);
  const [fOrder, setFOrder] = useState(0);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadPartners = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<PartnerRow[]>("/admin/store/partners", { auth: true });
      setPartners(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load partners");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPartners(); }, [loadPartners]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setFormErr(null);
    setSaving(true);
    try {
      await apiFetch("/admin/store/partners", {
        method: "POST",
        body: { name: fName, logo_url: fLogo, tagline: fTagline,
                product_type: fProductType, product_id: fProductId,
                price_gc: fPrice, display_order: fOrder },
      });
      setFName(""); setFLogo(""); setFTagline(""); setFProductId(""); setFPrice(100); setFOrder(0);
      await loadPartners();
    } catch (e: unknown) {
      setFormErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(id: string, current: boolean) {
    try {
      const updated = await apiFetch<PartnerRow>(`/admin/store/partners/${id}`, {
        method: "PATCH",
        body: { active: !current },
      });
      setPartners((prev) => prev.map((r) => (r.id === id ? { ...r, active: updated.active } : r)));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this partner?")) return;
    try {
      await apiFetch(`/admin/store/partners/${id}`, { method: "DELETE" });
      setPartners((p) => p.filter((r) => r.id !== id));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  }

  const inputCls = "rounded border border-ink-700 bg-ink-900 px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-grow-500";
  const labelCls = "text-[10px] uppercase tracking-widest text-gray-500";

  return (
    <Card>
      <CardHeader title="Store Partners" />
      <form onSubmit={handleAdd} className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Partner Name</label>
          <input className={inputCls} value={fName} onChange={(e) => setFName(e.target.value)} placeholder="Green Thumb Collective" required />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Logo URL</label>
          <input className={inputCls} value={fLogo} onChange={(e) => setFLogo(e.target.value)} placeholder="https://…" required />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Tagline (≤60 chars)</label>
          <input className={inputCls} maxLength={60} value={fTagline} onChange={(e) => setFTagline(e.target.value)} placeholder="Farm-to-bong, since 2018" required />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Product Type</label>
          <select className={inputCls} value={fProductType} onChange={(e) => setFProductType(e.target.value as "strain" | "consumable")}>
            <option value="consumable">Consumable</option>
            <option value="strain">Strain (UUID)</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Product ID / Key</label>
          <input className={inputCls} value={fProductId} onChange={(e) => setFProductId(e.target.value)} placeholder="bloom_booster or strain UUID" required />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Price (GC) · Display Order</label>
          <div className="flex gap-2">
            <input type="number" min={1} className={inputCls + " flex-1"} value={fPrice} onChange={(e) => setFPrice(Number(e.target.value))} required />
            <input type="number" min={0} className={inputCls + " w-16"} value={fOrder} onChange={(e) => setFOrder(Number(e.target.value))} />
            <button type="submit" disabled={saving} className="rounded bg-grow-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-grow-600 disabled:opacity-50">
              {saving ? "Saving…" : "Add"}
            </button>
          </div>
        </div>
        {formErr && <p className="col-span-full text-xs text-red-400">{formErr}</p>}
      </form>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : partners.length === 0 ? (
        <p className="text-sm text-gray-500">No partners configured. Add one above.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-700 text-left text-xs text-gray-500">
                <th className="pb-2 pr-4">Logo</th>
                <th className="pb-2 pr-4">Name · Tagline</th>
                <th className="pb-2 pr-4">Product</th>
                <th className="pb-2 pr-4 text-right">Price</th>
                <th className="pb-2 pr-4 text-center">Order</th>
                <th className="pb-2 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {partners.map((p) => (
                <tr key={p.id}>
                  <td className="py-2 pr-4">
                    <img src={p.logo_url} alt={p.name} className="w-8 h-8 rounded object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  </td>
                  <td className="py-2 pr-4">
                    <div className="text-gray-200">{p.name}</div>
                    <div className="text-[10px] text-gray-500">{p.tagline}</div>
                  </td>
                  <td className="py-2 pr-4">
                    <div className="text-gray-300 text-xs">{p.product_name ?? p.product_id}</div>
                    <div className="text-[10px] text-gray-600 capitalize">{p.product_type}</div>
                  </td>
                  <td className="py-2 pr-4 text-right font-mono text-gray-300">{gcFmt(p.price_gc)}</td>
                  <td className="py-2 pr-4 text-center text-gray-500">{p.display_order}</td>
                  <td className="py-2 pr-3 text-center">
                    <button
                      onClick={() => handleToggleActive(p.id, p.active)}
                      className={`rounded px-2 py-0.5 text-[10px] font-medium ${p.active ? "bg-grow-800/60 text-grow-300 hover:bg-red-800/40 hover:text-red-300" : "bg-gray-800/60 text-gray-500 hover:bg-grow-800/40 hover:text-grow-300"}`}
                    >
                      {p.active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="py-2 text-right">
                    <button onClick={() => handleDelete(p.id)} className="text-xs text-red-500 hover:text-red-300">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ---- Featured Items admin card ---------------------------------------------

interface FeaturedRow {
  id: string;
  item_type: string;
  item_id: string;
  label: string;
  badge: string;
  valid_through: string | null;
}

function FeaturedItemsCard() {
  const [items, setItems] = useState<FeaturedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fType, setFType] = useState("consumable");
  const [fId, setFId] = useState("");
  const [fLabel, setFLabel] = useState("");
  const [fBadge, setFBadge] = useState("limited");
  const [formErr, setFormErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<FeaturedRow[]>("/store/featured");
      setItems(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load featured items");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  async function handlePin(e: React.FormEvent) {
    e.preventDefault();
    setFormErr(null);
    setSaving(true);
    try {
      await apiFetch("/admin/store/featured", {
        method: "POST",
        body: { item_type: fType, item_id: fId, label: fLabel, badge: fBadge },
      });
      setFId(""); setFLabel("");
      await loadItems();
    } catch (e: unknown) {
      setFormErr(e instanceof Error ? e.message : "Failed to pin item");
    } finally {
      setSaving(false);
    }
  }

  async function handleUnpin(id: string) {
    try {
      await apiFetch(`/admin/store/featured/${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Unpin failed");
    }
  }

  const inputCls = "rounded border border-ink-700 bg-ink-900 px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-grow-500";
  const labelCls = "text-[10px] uppercase tracking-widest text-gray-500";
  const badgeMap: Record<string, string> = { seasonal: "text-amber-300 bg-amber-800/40", limited: "text-red-300 bg-red-800/40", new: "text-grow-300 bg-grow-800/40" };

  return (
    <Card>
      <CardHeader title="Featured Items (This Week's Drops)" />
      <form onSubmit={handlePin} className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Item Type</label>
          <select className={inputCls} value={fType} onChange={(e) => setFType(e.target.value)}>
            <option value="consumable">Consumable</option>
            <option value="strain">Strain</option>
            <option value="seasonal">Seasonal</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Item ID / Key</label>
          <input className={inputCls} value={fId} onChange={(e) => setFId(e.target.value)} placeholder="bloom_booster or UUID" required />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Display Label</label>
          <input className={inputCls} value={fLabel} onChange={(e) => setFLabel(e.target.value)} placeholder="Bloom Booster — Deal of the week" required />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Badge</label>
          <div className="flex gap-2">
            <select className={inputCls + " flex-1"} value={fBadge} onChange={(e) => setFBadge(e.target.value)}>
              <option value="limited">Limited</option>
              <option value="seasonal">Seasonal</option>
              <option value="new">New</option>
            </select>
            <button type="submit" disabled={saving} className="rounded bg-grow-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-grow-600 disabled:opacity-50">
              {saving ? "…" : "Pin"}
            </button>
          </div>
        </div>
        {formErr && <p className="col-span-full text-xs text-red-400">{formErr}</p>}
      </form>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">No featured items pinned. Use the form above to add up to 3.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-lg border border-ink-700 bg-ink-900/50 px-3 py-2">
              <span className={`rounded px-1.5 py-0.5 text-[9px] uppercase tracking-widest font-semibold ${badgeMap[item.badge] ?? "text-gray-300 bg-gray-700/40"}`}>
                {item.badge}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-200 truncate">{item.label}</p>
                <p className="text-[10px] text-gray-500">{item.item_type} · {item.item_id}</p>
              </div>
              <button onClick={() => handleUnpin(item.id)} className="text-xs text-red-500 hover:text-red-300 shrink-0">Unpin</button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ---- Page root -------------------------------------------------------------

function EconomyAdminInner() {
  const [projectorSeeds, setProjectorSeeds] = useState<ProjectorSeeds | undefined>(undefined);

  const handleSeed = useCallback((summary: LedgerSummary) => {
    setProjectorSeeds(deriveSeeds(summary));
  }, []);

  return (
    <div className="space-y-8">
      <LiveSnapshotCard onSeed={handleSeed} />
      <EconomyProjectorInner seeds={projectorSeeds} />
      <SeasonalDropsCard />
      <StorePartnersCard />
      <FeaturedItemsCard />
    </div>
  );
}

export default function EconomyAdminPage() {
  return (
    <RequireAuth>
      <EconomyAdminInner />
    </RequireAuth>
  );
}
