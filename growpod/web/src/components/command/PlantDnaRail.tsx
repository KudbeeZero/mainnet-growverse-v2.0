"use client";

import { Bar } from "@/components/ui/Bar";
import { traitRows } from "@/lib/traits";
import { morphologyRows } from "@/lib/morphologyRows";
import { seedId, rarityStars } from "@/lib/cosmetics";
import { RARITY_STYLES, titleCase } from "@/lib/format";
import { CollapsiblePanel } from "@/components/ui/CollapsiblePanel";
import type { GrowthStage, Strain } from "@/lib/types";

function SummaryRow({ label, value, tag }: { label: string; value: string; tag?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <span className="instrument-label text-[10px]">{label}</span>
      <span className="flex items-center gap-1.5 text-right text-xs font-semibold text-gray-100">
        {value}
        {tag && (
          <span className="rounded border border-cyan-400/30 bg-cyan-400/10 px-1 text-[9px] font-medium text-cyan-200">
            {tag}
          </span>
        )}
      </span>
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="mb-1.5 mt-3 border-b border-ink-700 pb-1 text-[10px] font-bold tracking-[0.18em] text-cyan-300/70">
      {children}
    </div>
  );
}

function geneticsLabel(strain: Strain): string {
  const r = strain.indica_ratio;
  return r >= 0.66 ? "Indica" : r <= 0.34 ? "Sativa" : "Balanced";
}

/** Left "PLANT DNA" rail: identity + 0–100 trait bars + derived morphology. */
export function PlantDnaRail({
  strain,
  plantId,
  stage,
}: {
  strain: Strain | undefined;
  plantId: string;
  stage: GrowthStage;
}) {
  const traits = traitRows(strain);
  const morph = morphologyRows(strain, stage);
  const stars = strain ? rarityStars(strain.rarity) : 0;

  return (
    <CollapsiblePanel title="⬡ PLANT DNA" titleClassName="text-grow-300">
      {!strain ? (
        <p className="text-xs text-gray-500">Loading genetics…</p>
      ) : (
        <>
          <div>
            <SummaryRow label="STRAIN" value={strain.name} />
            <SummaryRow label="GENETICS" value={geneticsLabel(strain)} tag={titleCase(strain.lineage_type)} />
            <SummaryRow label="GENERATION" value={`F${strain.generation}`} />
            <SummaryRow label="SEED ID" value={seedId(strain, plantId)} />
            <div className="flex items-baseline justify-between gap-2 py-0.5">
              <span className="instrument-label text-[10px]">RARITY</span>
              <span className="flex items-center gap-1.5">
                <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${RARITY_STYLES[strain.rarity]}`}>
                  {titleCase(strain.rarity)}
                </span>
                <span className="text-[10px] text-amber-300">{"★".repeat(stars)}</span>
              </span>
            </div>
          </div>

          <SectionLabel>TRAITS</SectionLabel>
          <div className="space-y-1.5">
            {traits.map((t) => (
              <Bar key={t.key} label={t.label} value={t.value} />
            ))}
          </div>

          <SectionLabel>MORPHOLOGY</SectionLabel>
          <div>
            {morph.map((r) => (
              <SummaryRow key={r.label} label={r.label} value={r.value} />
            ))}
          </div>
        </>
      )}
    </CollapsiblePanel>
  );
}
