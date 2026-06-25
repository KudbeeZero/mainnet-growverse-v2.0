"use client";

// Phase 3 — Explorer grow-param controls. Native range inputs (keyboard- and
// screen-reader-accessible out of the box) that drive AnatomyExplorer's `params`
// prop; each change re-runs the PURE generators, so the bud stays deterministic
// for a given (genetics, seed, params). No three.js here.

import { Button } from "@/components/ui/Button";
import type { ExplorerParams } from "@/lib/chamber3d/explorer/parts";

/** The 0..1 grow params the panel exposes, in teaching order. */
const FIELDS: { key: NumericParamKey; label: string; hint: string }[] = [
  { key: "budDev", label: "Bud development", hint: "How far the cola has accreted and swelled." },
  { key: "ripe", label: "Ripeness", hint: "Frost maturity (clear → amber) and pistil ambering." },
  { key: "trich", label: "Frost", hint: "Trichome coverage across the calyxes." },
  { key: "brown", label: "Pistil browning", hint: "Pistils brown and curl as they age out." },
  { key: "purple", label: "Purple", hint: "Anthocyanin: lavender frost and magenta pistils." },
];

/** Keys of ExplorerParams that are 0..1 numbers (excludes the isMobile flag). */
type NumericParamKey = "budDev" | "ripe" | "brown" | "trich" | "purple";

export interface ExplorerControlsProps {
  params: ExplorerParams;
  onChange: (next: ExplorerParams) => void;
  onReset: () => void;
}

export function ExplorerControls({ params, onChange, onReset }: ExplorerControlsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="instrument-label text-accent-300">GROW PARAMETERS</h3>
        <Button variant="ghost" size="sm" onClick={onReset}>
          Reset
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => {
          const value = params[f.key];
          const id = `explorer-${f.key}`;
          return (
            <div key={f.key} className="space-y-1">
              <label htmlFor={id} className="flex items-center justify-between text-sm text-gray-200">
                <span>{f.label}</span>
                <span className="tabular-nums text-gray-400">{Math.round(value * 100)}%</span>
              </label>
              <input
                id={id}
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={value}
                onChange={(e) => onChange({ ...params, [f.key]: Number(e.target.value) })}
                aria-describedby={`${id}-hint`}
                aria-valuetext={`${Math.round(value * 100)} percent`}
                className="w-full accent-grow-500"
              />
              <p id={`${id}-hint`} className="text-xs text-gray-500">
                {f.hint}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
