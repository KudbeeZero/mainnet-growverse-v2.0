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

// ---- Economy Projector -----------------------------------------------------

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

// ---- Page root -------------------------------------------------------------

function EconomyAdminInner() {
  return (
    <div className="space-y-8">
      <EconomyProjectorInner />
      <SeasonalDropsCard />
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
