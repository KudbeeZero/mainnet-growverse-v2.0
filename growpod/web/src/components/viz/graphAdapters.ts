// Adapters that turn domain data into Constellation nodes/edges. Keeps the
// canvas component generic and the "DNA is a graph" mapping in one place.

import type { ConstNode, ConstEdge } from "./Constellation";
import type { Strain, Lineage, LineageNode } from "@/lib/types";
import { RARITY_HEX, titleCase } from "@/lib/format";

/** A strain's genome → a star constellation: a central hub with each locus as a
 *  node; high-value (expressed) traits become luminous hubs. */
export function genomeGraph(strain: Strain): { nodes: ConstNode[]; edges: ConstEdge[] } {
  const genome = strain.genome ?? {};
  const nodes: ConstNode[] = [
    { id: "__center", label: strain.name, hub: true, fx: 0, fy: 0, color: RARITY_HEX[strain.rarity], weight: 1 },
  ];
  const edges: ConstEdge[] = [];
  for (const [trait, gene] of Object.entries(genome)) {
    const value = typeof gene?.value === "number" ? gene.value : 0.5;
    const expressed = value >= 0.6;
    nodes.push({
      id: trait,
      label: `${titleCase(trait)} ${(value * 100).toFixed(0)}%`,
      weight: Math.max(0.15, Math.min(1, value)),
      hub: expressed,
      color: expressed ? "#a78bfa" : "#76c024",
    });
    edges.push({ a: "__center", b: trait, strength: 0.6 + value * 0.4 });
  }
  return { nodes, edges };
}

/** Verifiable pedigree → constellation. Nodes tinted by rarity, parent→child
 *  edges, the queried strain pinned at center. */
export function lineageGraph(
  lineage: Lineage,
  rootId: string,
): { nodes: ConstNode[]; edges: ConstEdge[] } {
  const ids = new Set(lineage.lineage.map((n) => n.strain_id));
  const nodes: ConstNode[] = lineage.lineage.map((n: LineageNode) => ({
    id: n.strain_id,
    label: `${n.name}${n.root ? " ◌" : n.verified ? " ✓" : n.verified === false ? " ✕" : ""}`,
    weight: n.root ? 0.85 : 0.5,
    hub: n.strain_id === rootId || !!n.root,
    color: RARITY_HEX[n.rarity] ?? "#9ca3af",
    ...(n.strain_id === rootId ? { fx: 0, fy: 0 } : {}),
  }));
  const edges: ConstEdge[] = [];
  for (const n of lineage.lineage) {
    for (const pid of [n.parent_a_id, n.parent_b_id]) {
      if (pid && ids.has(pid)) edges.push({ a: pid, b: n.strain_id });
    }
  }
  return { nodes, edges };
}

/** The GenBank: many cultivars as one galaxy, pedigree edges where known. */
export function genbankGraph(
  strains: Strain[],
  limit = 140,
): { nodes: ConstNode[]; edges: ConstEdge[] } {
  const slice = strains.slice(0, limit);
  const ids = new Set(slice.map((s) => s.id));
  const nodes: ConstNode[] = slice.map((s) => ({
    id: s.id,
    label: s.name,
    weight: 0.3 + Math.min(0.6, s.generation * 0.1),
    hub: s.rarity === "legendary" || s.rarity === "epic",
    color: RARITY_HEX[s.rarity] ?? "#9ca3af",
  }));
  const edges: ConstEdge[] = [];
  for (const s of slice) {
    for (const pid of [s.parent_a_id, s.parent_b_id]) {
      if (pid && ids.has(pid)) edges.push({ a: pid, b: s.id });
    }
  }
  return { nodes, edges };
}
