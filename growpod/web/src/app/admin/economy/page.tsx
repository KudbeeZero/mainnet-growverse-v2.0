"use client";

import { useState } from "react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

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

function EconomyProjectorInner() {
  const [players, setPlayers] = useState(500);
  const [growCyclesPerMonth, setGrowCyclesPerMonth] = useState(4);
  const [gcPerHarvest, setGcPerHarvest] = useState(80);
  const [dailyBonusGc, setDailyBonusGc] = useState(10);
  const [seedCostAvg, setSeedCostAvg] = useState(40);
  const [tuitionAvgMonthly, setTuitionAvgMonthly] = useState(25);
  const [premiumStrainPrice, setPremiumStrainPrice] = useState(250);
  const [premiumPurchaseRate, setPremiumPurchaseRate] = useState(0.05);

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
            <TableRow label="Premium strain drops" value={premiumSink} total={totalFaucet} type="sink" />
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

export default function EconomyAdminPage() {
  return (
    <RequireAuth>
      <EconomyProjectorInner />
    </RequireAuth>
  );
}
