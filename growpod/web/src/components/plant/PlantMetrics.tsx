import { Gauge } from "@/components/ui/Gauge";
import { Metric } from "@/components/ui/Metric";
import { num } from "@/lib/format";
import type { PlantState } from "@/lib/types";

/**
 * The scientist readouts the design codex calls for — VPD on a banded gauge,
 * plus DLI / PPFD / photoperiod. Sourced from the derived metrics the backend
 * exposes on GET .../state (simulation/horticulture.py, Phase A).
 */
export function PlantMetrics({ plant, compact = false }: { plant: PlantState; compact?: boolean }) {
  const m = plant.metrics;
  if (!m) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-3 text-[11px]">
        <span className="instrument-label">VPD</span>
        <span className="instrument-value text-gray-200">
          {m.vpd_kpa === null ? "—" : m.vpd_kpa.toFixed(2)}
          <span className="text-gray-500"> kPa</span>
        </span>
        <span className="instrument-label">DLI</span>
        <span className="instrument-value text-gray-200">{num(m.dli_mol, 1)}</span>
        <span className="instrument-label">PPFD</span>
        <span className="instrument-value text-gray-200">{num(m.ppfd, 0)}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Gauge label="VPD kPa" value={m.vpd_kpa} unit="kPa" min={0} max={2.5} optimal={[0.8, 1.4]} />
      <div className="grid flex-1 grid-cols-3 gap-2">
        <Metric label="DLI" value={num(m.dli_mol, 1)} unit="mol·m⁻²·d⁻¹" tone="accent" />
        <Metric label="PPFD" value={num(m.ppfd, 0)} unit="µmol·m⁻²·s⁻¹" tone="accent" />
        <Metric label="Photoperiod" value={num(m.photoperiod_hours, 0)} unit="h" />
      </div>
    </div>
  );
}
