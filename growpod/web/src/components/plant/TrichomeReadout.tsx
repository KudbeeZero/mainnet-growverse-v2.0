"use client";

import type { TrichomeTelemetry } from "@/lib/types";

// Live trichome telemetry (server truth) — the "hairs on the pistils" data:
// frost density, clear→cloudy→amber ripeness split, and the harvest-window call.
// Mirrors the reference UI mock. Read-only; never affects gameplay/economy.

const WINDOW_STYLE: Record<TrichomeTelemetry["harvest_window"], string> = {
  not_flowering: "text-gray-500 border-ink-700",
  developing: "text-cyan-300/70 border-cyan-400/30",
  early: "text-cyan-200 border-cyan-400/40",
  peak: "text-grow-300 border-grow-500/50",       // the ideal window
  ripe: "text-amber-300 border-amber-400/50",
  overripe: "text-orange-300 border-orange-400/50",
};

function Bar({ label, pct, className }: { label: string; pct: number; className: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 flex-none font-mono text-[9px] tracking-[0.08em] text-cyan-200/55">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700">
        <div className={`h-full rounded-full ${className}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </div>
      <span className="w-9 flex-none text-right font-mono text-[10px] font-bold text-white">{pct.toFixed(0)}%</span>
    </div>
  );
}

export function TrichomeReadout({ t }: { t: TrichomeTelemetry | undefined }) {
  if (!t || !t.active) return null;
  const win = t.harvest_window;
  return (
    <div className="rounded-xl border border-cyan-400/30 bg-[#08141e]/85 p-2.5 font-mono backdrop-blur">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-[0.14em] text-cyan-200/80">🔬 TRICHOMES</span>
        <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${WINDOW_STYLE[win]}`}>
          {win}
        </span>
      </div>
      <div className="mb-1.5 flex items-center justify-between text-[10px]">
        <span className="text-cyan-200/55">FROST DENSITY</span>
        <span className="font-bold text-white">{Math.round(t.density * 100)}%</span>
      </div>
      <div className="space-y-1">
        <Bar label="CLEAR" pct={t.clear_pct} className="bg-cyan-200/70" />
        <Bar label="CLOUDY" pct={t.cloudy_pct} className="bg-gray-200" />
        <Bar label="AMBER" pct={t.amber_pct} className="bg-amber-400" />
      </div>
      <p className="mt-1.5 text-[9px] leading-snug text-cyan-200/60">{t.recommendation}</p>
    </div>
  );
}
