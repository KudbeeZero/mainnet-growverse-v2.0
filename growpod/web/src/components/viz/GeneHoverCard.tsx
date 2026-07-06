"use client";

// The rich DOM hover-card that floats over the Constellation canvas. The canvas
// reports which node is hovered (id + screen-pixel position) via
// `Constellation.onHoverNode`; each host page maps that id to a `HoverContent`
// out of its OWN domain data (genome locus, cultivar, pedigree node) and renders
// this card. One component, one look, reused everywhere a glowing dot appears —
// including bred/offspring genomes.
//
// The card is absolutely positioned inside the host's `position: relative`
// wrapper (the same coordinate box as the canvas), clamps itself on-screen
// (flips to the other side of the dot near an edge), and is `pointer-events-none`
// so it can never steal the pointer from the canvas beneath it. Entrance motion
// is a soft scale+fade (`.gpe-hovercard`), disabled under prefers-reduced-motion.

import { useLayoutEffect, useRef, useState } from "react";
import { RarityChip, VerifyBadge } from "@/components/ui/Pills";
import { titleCase, num, RARITY_HEX } from "@/lib/format";
import type { Rarity, Strain, LineageNode } from "@/lib/types";

/** A single genome locus (a DNA-tab / breed-cloud dot). */
export interface LocusHover {
  kind: "locus";
  trait: string; // raw locus key, e.g. "thc_potency"
  valuePct: number; // 0..100 expression
  dominance?: string; // genotype, e.g. "AA" / "Aa" / "aa"
  expressed: boolean; // value >= 0.6
  color: string; // hex node fill
}

/** A whole cultivar (a GenBank galaxy dot, or a genome-graph center node). */
export interface StrainHover {
  kind: "strain";
  name: string;
  rarity: Rarity;
  generation: number;
  color: string;
  lineageType?: string;
  thc?: [number, number];
  cbd?: [number, number];
  yieldRange?: [number, number];
  flowering?: [number, number];
  stability?: number;
  terpenes?: string[] | null;
  verifiable?: boolean;
  verified?: boolean;
}

/** A pedigree node (a Lineage-tab dot). */
export interface LineageHover {
  kind: "lineage";
  name: string;
  rarity: Rarity;
  generation: number;
  color: string;
  root?: boolean;
  verified?: boolean;
  rngSeed?: number;
}

export type HoverContent = LocusHover | StrainHover | LineageHover;

interface Props {
  /** Canvas-local pixel position of the hovered dot. */
  x: number;
  y: number;
  /** Resolved content for the hovered id, or null to render nothing. */
  content: HoverContent | null;
}

const EYEBROW: Record<HoverContent["kind"], string> = {
  locus: "GENE LOCUS",
  strain: "CULTIVAR",
  lineage: "PEDIGREE NODE",
};

export function GeneHoverCard({ x, y, content }: Props) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: x, top: y });

  useLayoutEffect(() => {
    const el = cardRef.current;
    const parent = el?.offsetParent as HTMLElement | null;
    if (!el || !parent) return;
    const cw = el.offsetWidth;
    const ch = el.offsetHeight;
    const pw = parent.clientWidth;
    const ph = parent.clientHeight;
    const gap = 16;
    // Prefer the right of the dot; flip left if it would overflow.
    let left = x + gap;
    if (left + cw > pw - 6) left = x - gap - cw;
    if (left < 6) left = 6;
    // Vertically center on the dot, clamped to the box.
    let top = y - ch / 2;
    top = Math.max(6, Math.min(top, ph - ch - 6));
    setPos((prev) => (prev.left === left && prev.top === top ? prev : { left, top }));
  }, [x, y, content]);

  if (!content) return null;

  const color = content.color;

  return (
    <div
      ref={cardRef}
      role="tooltip"
      className="gpe-hovercard pointer-events-none absolute z-30 w-max max-w-[260px] rounded-xl border border-ink-600 bg-ink-900/95 px-3 py-2.5 backdrop-blur"
      style={{
        left: pos.left,
        top: pos.top,
        boxShadow: `0 0 0 1px ${color}55, 0 0 22px -4px ${color}80, 0 10px 34px -10px rgba(0,0,0,0.75)`,
      }}
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: color, boxShadow: `0 0 8px ${color}` }}
        />
        <span className="instrument-label" style={{ color: `${color}` }}>
          {EYEBROW[content.kind]}
        </span>
      </div>

      {content.kind === "locus" && <LocusBody c={content} />}
      {content.kind === "strain" && <StrainBody c={content} />}
      {content.kind === "lineage" && <LineageBody c={content} />}
    </div>
  );
}

function LocusBody({ c }: { c: LocusHover }) {
  const pct = Math.round(c.valuePct);
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-gray-50">{titleCase(c.trait)}</span>
        <span
          className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
            c.expressed
              ? "border-violet-500/50 bg-violet-500/15 text-violet-200"
              : "border-grow-600/50 bg-grow-900/40 text-grow-200"
          }`}
        >
          {c.expressed ? "Expressed" : "Recessive"}
        </span>
      </div>

      <div className="flex items-end gap-1.5">
        <span
          className="instrument-value text-2xl font-bold leading-none"
          style={{ color: c.color }}
        >
          {pct}
        </span>
        <span className="text-xs text-gray-500">% expression</span>
      </div>

      {/* value bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(2, Math.min(100, pct))}%`,
            background: c.color,
            boxShadow: `0 0 8px ${c.color}`,
          }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-gray-600">
        <span>0%</span>
        <span className="text-gray-500">expressed ≥ 60%</span>
        <span>100%</span>
      </div>

      {c.dominance && (
        <div className="flex items-center justify-between border-t border-ink-700/70 pt-1.5">
          <span className="instrument-label">Genotype</span>
          <Genotype code={c.dominance} />
        </div>
      )}
    </div>
  );
}

/** Renders a genotype string ("Aa") with the dominant (uppercase) allele
 *  highlighted and the recessive (lowercase) dimmed — the biology at a glance. */
function Genotype({ code }: { code: string }) {
  return (
    <span className="instrument-value flex gap-0.5 text-sm font-bold">
      {code.split("").map((allele, i) => {
        const dominant = allele === allele.toUpperCase() && allele.toLowerCase() !== allele;
        return (
          <span
            key={i}
            className={`inline-flex h-5 w-5 items-center justify-center rounded ${
              dominant
                ? "bg-grow-700/60 text-grow-100"
                : "bg-ink-700/80 text-gray-400"
            }`}
          >
            {allele}
          </span>
        );
      })}
    </span>
  );
}

function StrainBody({ c }: { c: StrainHover }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-50">{c.name}</span>
        <RarityChip rarity={c.rarity} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
        <span className="instrument-label">GEN {c.generation}</span>
        {c.lineageType && <span className="text-gray-500">· {titleCase(c.lineageType)}</span>}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        {c.thc && <Metric label="THC" value={`${num(c.thc[0], 1)}–${num(c.thc[1], 1)}%`} />}
        {c.cbd && <Metric label="CBD" value={`${num(c.cbd[0], 1)}–${num(c.cbd[1], 1)}%`} />}
        {c.yieldRange && (
          <Metric label="Yield" value={`${num(c.yieldRange[0])}–${num(c.yieldRange[1])} g`} />
        )}
        {c.flowering && (
          <Metric label="Flower" value={`${num(c.flowering[0])}–${num(c.flowering[1])} d`} />
        )}
        {typeof c.stability === "number" && (
          <Metric label="Stability" value={`${Math.round(c.stability * 100)}%`} />
        )}
      </div>

      {c.terpenes && c.terpenes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {c.terpenes.slice(0, 4).map((t) => (
            <span
              key={t}
              className="rounded-full border border-violet-500/40 bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-300"
            >
              {titleCase(t)}
            </span>
          ))}
        </div>
      )}

      {c.verifiable !== undefined && (
        <div className="border-t border-ink-700/70 pt-1.5">
          <VerifyBadge verifiable={c.verifiable} verified={c.verified} />
        </div>
      )}
    </div>
  );
}

function LineageBody({ c }: { c: LineageHover }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-50">{c.name}</span>
        <RarityChip rarity={c.rarity} />
      </div>
      <div className="instrument-label">GEN {c.generation}</div>
      <div className="border-t border-ink-700/70 pt-1.5">
        {c.root ? (
          <VerifyBadge verifiable={false} />
        ) : (
          <VerifyBadge verifiable verified={c.verified} />
        )}
      </div>
      {typeof c.rngSeed === "number" && (
        <div className="flex items-center justify-between text-[10px]">
          <span className="instrument-label">RNG seed</span>
          <span className="instrument-value text-gray-400">{c.rngSeed}</span>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-gray-500">{label}</span>
      <span className="instrument-value text-gray-200">{value}</span>
    </div>
  );
}

// ---- content builders (map a hovered node id → rich card content) ----------
// Mirrors graphAdapters' node-id conventions so a host can resolve any hovered
// dot straight from the strain/lineage data it already holds.

/** Whole-cultivar card content (a GenBank dot or a genome-graph center node). */
export function strainHoverContent(strain: Strain): StrainHover {
  return {
    kind: "strain",
    name: strain.name,
    rarity: strain.rarity,
    generation: strain.generation,
    color: RARITY_HEX[strain.rarity] ?? "#9ca3af",
    lineageType: strain.lineage_type,
    thc: strain.thc_range,
    cbd: strain.cbd_range,
    yieldRange: strain.yield_range,
    flowering: strain.flowering_days,
    stability: strain.stability,
    terpenes: strain.terpenes,
  };
}

/** Resolve a genomeGraph node id against a strain: "__center" → the cultivar,
 *  any other id → that genome locus. Returns null for an unknown id. */
export function genomeHoverContent(strain: Strain, id: string): HoverContent | null {
  if (id === "__center") return strainHoverContent(strain);
  const gene = strain.genome?.[id];
  if (!gene) return null;
  const value = typeof gene.value === "number" ? gene.value : 0.5;
  const expressed = value >= 0.6;
  return {
    kind: "locus",
    trait: id,
    valuePct: value * 100,
    dominance: gene.dominance,
    expressed,
    color: expressed ? "#a78bfa" : "#76c024",
  };
}

/** Pedigree-node card content from a LineageNode. */
export function lineageHoverContent(node: LineageNode): LineageHover {
  return {
    kind: "lineage",
    name: node.name,
    rarity: node.rarity,
    generation: node.generation,
    color: RARITY_HEX[node.rarity] ?? "#9ca3af",
    root: node.root,
    verified: node.verified,
    rngSeed: node.rng_seed,
  };
}
