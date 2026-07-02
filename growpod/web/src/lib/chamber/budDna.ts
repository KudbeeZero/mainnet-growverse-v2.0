// Per-strain Bud DNA — the measurements the procedural macro generator reads to
// build a strain's cola (blueprint §10). Authored for curated strains; derived
// from the strain's bud colour otherwise. Dimensions are in "DNA units" and are
// scaled to the canvas at build time, so only the *ratios* between strains
// matter (a wider maxBudWidth/budHeight → a chunkier cola).

import { clamp, type BudColor } from "./morphology";
import { slugify } from "./strainVisuals";
import type { GenomeBudDNA } from "@/lib/types";

export interface PaletteColor { hue: number; sat: number; lit: number; weight: number }

export interface BudDNA {
  // ---- GENETIC (the strain's base look; set in the authored presets) ----
  budHeight: number;
  maxBudWidth: number;
  rows: number;
  calyxPerRowMin: number;
  calyxPerRowMax: number;
  calyxSizeMin: number;
  calyxSizeMax: number;
  overlap: number; // 0.6–0.75
  pistilChance: number;
  sugarLeafChance: number;
  trichomeDensity: number;
  palette: PaletteColor[]; // weighted calyx colours

  // ---- ENVIRONMENTAL MODIFIERS (added by applyEnvironmentToBudDNA; default 0)
  // These nudge the rendered phenotype from grow conditions WITHOUT replacing
  // the genetic identity. They are absent on the raw presets.
  foxtailBias?: number;   // light stress → more pointed/foxtail calyxes
  topStretch?: number;    // light stress → stretched, irregular top
  highlightBoost?: number;// high UV → brighter specular highlights
  moldRisk?: number;      // high humidity → hidden risk score (no visual yet)
}

// Named calyx colours used to compose strain palettes.
const C = {
  green: { hue: 110, sat: 50, lit: 37 },
  lime: { hue: 92, sat: 60, lit: 48 },
  deepGreen: { hue: 126, sat: 46, lit: 26 },
  purple: { hue: 282, sat: 56, lit: 42 },
  magenta: { hue: 312, sat: 62, lit: 47 },
  deepPurple: { hue: 270, sat: 54, lit: 30 },
  // Blue Dream family — the cool blue-teal calyx tones under silvery frost
  // (owner harvest reference, 2026-07-02). No anthocyanin purple: the "blue"
  // is a desaturated teal-sage green reading pale under heavy trichomes.
  sageTeal: { hue: 155, sat: 30, lit: 44 },
  frostBlue: { hue: 185, sat: 22, lit: 55 },
  deepTeal: { hue: 168, sat: 34, lit: 30 },
} as const;

function pal(parts: Array<[keyof typeof C, number]>): PaletteColor[] {
  return parts.map(([k, weight]) => ({ ...C[k], weight }));
}

const FALLBACK_COLOR: PaletteColor = { hue: 110, sat: 45, lit: 36, weight: 1 };

export function pickPaletteColor(palette: PaletteColor[], roll: number): PaletteColor {
  if (palette.length === 0) return FALLBACK_COLOR; // never deref undefined in the draw loop
  const total = palette.reduce((s, p) => s + Math.max(0, p.weight), 0);
  if (total <= 0) return palette[0];
  let r = roll * total;
  for (const p of palette) {
    r -= Math.max(0, p.weight);
    if (r <= 0) return p;
  }
  return palette[palette.length - 1];
}

/** The dominant (highest-weight) palette colour — used for the cola core so it
 * tracks the palette (incl. env purple shift) instead of a fixed base hue. */
export function dominantPaletteColor(palette: PaletteColor[]): PaletteColor {
  if (palette.length === 0) return FALLBACK_COLOR;
  return palette.reduce((best, p) => (p.weight > best.weight ? p : best), palette[0]);
}

const AUTHORED: Record<string, BudDNA> = {
  g13: {
    budHeight: 170, maxBudWidth: 75, rows: 18, calyxPerRowMin: 3, calyxPerRowMax: 7,
    calyxSizeMin: 7, calyxSizeMax: 14, overlap: 0.68, pistilChance: 0.32,
    sugarLeafChance: 0.12, trichomeDensity: 0.7, palette: pal([["green", 3], ["lime", 1.5], ["deepGreen", 2]]),
  },
  "purple-diddy-punch": {
    budHeight: 150, maxBudWidth: 95, rows: 16, calyxPerRowMin: 3, calyxPerRowMax: 8,
    calyxSizeMin: 8, calyxSizeMax: 16, overlap: 0.72, pistilChance: 0.34,
    sugarLeafChance: 0.1, trichomeDensity: 0.85, palette: pal([["purple", 3], ["magenta", 1.5], ["deepPurple", 2.5]]),
  },
  "animal-mints": {
    budHeight: 160, maxBudWidth: 85, rows: 17, calyxPerRowMin: 3, calyxPerRowMax: 7,
    calyxSizeMin: 7, calyxSizeMax: 15, overlap: 0.7, pistilChance: 0.33,
    sugarLeafChance: 0.12, trichomeDensity: 0.95, palette: pal([["green", 2.5], ["lime", 1.5], ["purple", 1.5], ["deepPurple", 1.5]]),
  },
  // Heavy indica — the widest, chunkiest cola; dense green, very frosty.
  "white-rhino": {
    budHeight: 150, maxBudWidth: 100, rows: 16, calyxPerRowMin: 3, calyxPerRowMax: 8,
    calyxSizeMin: 9, calyxSizeMax: 17, overlap: 0.73, pistilChance: 0.3,
    sugarLeafChance: 0.12, trichomeDensity: 0.88, palette: pal([["green", 3], ["deepGreen", 2], ["lime", 1]]),
  },
  // Bright, frosty OG — slim-ish tall cola, the brightest lime-green, max frost.
  "white-fire-og": {
    budHeight: 168, maxBudWidth: 78, rows: 18, calyxPerRowMin: 3, calyxPerRowMax: 7,
    calyxSizeMin: 7, calyxSizeMax: 14, overlap: 0.69, pistilChance: 0.32,
    sugarLeafChance: 0.1, trichomeDensity: 0.97, palette: pal([["lime", 3], ["green", 2], ["deepGreen", 1]]),
  },
  // Purple dessert — high anthocyanin, colourful: purple/magenta-led with a green base.
  gelato: {
    budHeight: 160, maxBudWidth: 86, rows: 17, calyxPerRowMin: 3, calyxPerRowMax: 7,
    calyxSizeMin: 7, calyxSizeMax: 15, overlap: 0.7, pistilChance: 0.33,
    sugarLeafChance: 0.12, trichomeDensity: 0.85, palette: pal([["green", 1.5], ["lime", 1], ["purple", 3], ["magenta", 2], ["deepPurple", 1]]),
  },
  // Blue Dream — the flagship sativa spear (owner harvest reference,
  // 2026-07-02): the LONGEST, tapered cola in the catalog, pale blue-teal
  // calyxes under silvery frost, golden pistils threaded throughout.
  "blue-dream": {
    budHeight: 185, maxBudWidth: 72, rows: 20, calyxPerRowMin: 3, calyxPerRowMax: 6,
    calyxSizeMin: 6, calyxSizeMax: 13, overlap: 0.66, pistilChance: 0.38,
    sugarLeafChance: 0.14, trichomeDensity: 0.92, palette: pal([["sageTeal", 3], ["frostBlue", 2], ["deepTeal", 1.5], ["green", 1]]),
  },
  // Creamy purple dessert — high anthocyanin, tightest packing, heavy frost.
  "wedding-cake": {
    budHeight: 158, maxBudWidth: 88, rows: 18, calyxPerRowMin: 4, calyxPerRowMax: 8,
    calyxSizeMin: 7, calyxSizeMax: 15, overlap: 0.74, pistilChance: 0.33,
    sugarLeafChance: 0.13, trichomeDensity: 0.93, palette: pal([["green", 2], ["lime", 1], ["purple", 2.5], ["deepPurple", 1.5], ["magenta", 1]]),
  },
};

/**
 * Build a palette from a genome-derived BudDNA profile. The palette is composed
 * from the calyx hue + anthocyanin + dominant terpene signals, creating a
 * unique colour signature for each strain based on its genetics.
 */
function paletteFromGenomeBudDNA(gbd: GenomeBudDNA, color: BudColor): PaletteColor[] {
  const palette: PaletteColor[] = [
    { hue: gbd.calyx_hue, sat: gbd.calyx_sat, lit: 38, weight: 3 },
    { hue: gbd.calyx_hue, sat: gbd.calyx_sat, lit: 28, weight: 1.5 },
  ];
  if (gbd.anthocyanin > 0.3) {
    palette.push({ hue: 282, sat: 56, lit: 36, weight: gbd.anthocyanin * 5 });
    if (gbd.anthocyanin > 0.5) {
      palette.push({ hue: 270, sat: 54, lit: 30, weight: (gbd.anthocyanin - 0.5) * 4 });
    }
  } else if (gbd.anthocyanin > 0.1) {
    palette.push({ hue: gbd.calyx_hue, sat: gbd.calyx_sat, lit: 30, weight: 1 });
  }
  return palette;
}

/**
 * Build a full BudDNA from the genome-derived profile the backend computed.
 * This overrides the generic fallback with per-genome shape, size, colour,
 * and frost — every strain gets a unique phenotype based on its genetics.
 */
export function budDnaFromGenome(gbd: GenomeBudDNA, color: BudColor): BudDNA {
  return {
    budHeight: gbd.bud_height,
    maxBudWidth: gbd.max_bud_width,
    rows: gbd.rows,
    calyxPerRowMin: gbd.calyx_per_row_min,
    calyxPerRowMax: gbd.calyx_per_row_max,
    calyxSizeMin: gbd.calyx_size_min,
    calyxSizeMax: gbd.calyx_size_max,
    overlap: gbd.overlap,
    pistilChance: gbd.pistil_chance,
    sugarLeafChance: gbd.sugar_leaf_chance,
    trichomeDensity: gbd.trichome_density,
    palette: paletteFromGenomeBudDNA(gbd, color),
    foxtailBias: gbd.foxtail_bias,
  };
}

/** Authored DNA for curated strains, else genome-derived or default fallback. */
export function budDnaFor(slugOrName: string | undefined, color: BudColor, genomeBud?: GenomeBudDNA | null): BudDNA {
  if (genomeBud) {
    return budDnaFromGenome(genomeBud, color);
  }
  if (slugOrName) {
    const key = AUTHORED[slugOrName] ? slugOrName : slugify(slugOrName);
    if (AUTHORED[key]) return AUTHORED[key];
  }
  const palette: PaletteColor[] = [
    { hue: color.calyxHue, sat: color.calyxSat, lit: 38, weight: 3 },
    { hue: color.calyxHue, sat: color.calyxSat, lit: 28, weight: 1.5 },
  ];
  if (color.accentFrac && color.accentHue != null) {
    palette.push({ hue: color.accentHue, sat: color.calyxSat + 6, lit: 36, weight: color.accentFrac * 4 });
  } else if (color.anthocyanin > 0.5) {
    palette.push({ hue: color.calyxHue, sat: color.calyxSat, lit: 30, weight: 1 });
  }
  return {
    budHeight: 160, maxBudWidth: 85, rows: 16, calyxPerRowMin: 3, calyxPerRowMax: 7,
    calyxSizeMin: 7, calyxSizeMax: 15, overlap: 0.7, pistilChance: 0.32,
    sugarLeafChance: 0.12, trichomeDensity: clamp(0.6 + color.anthocyanin * 0.25, 0, 1), palette,
  };
}

// Raw grow conditions the bud reacts to. Pulled from the pod environment + the
// plant's water level on the chamber page; left at neutral defaults elsewhere.
export interface GrowEnvironment {
  temp: number;     // °C  (low → cool nights)
  light: number;    // PPFD-ish 0..1000 (high → UV/strong light; very high → light stress)
  humidity: number; // %   (high → mold risk)
  water: number;    // plant water level 0..100 (low → drought stress)
}

const PURPLE_LO = 255, PURPLE_HI = 320; // hue band counted as "purple-capable"

/**
 * Return a NEW BudDNA with the grow environment's subtle visual modifiers
 * applied — never mutates the genetic preset. Identity-preserving by design:
 * green strains gain only a faint purple shadow on cool nights, while
 * purple-capable strains shift much harder.
 */
export function applyEnvironmentToBudDNA(base: BudDNA, env: GrowEnvironment): BudDNA {
  const cool = clamp((20 - env.temp) / 8, 0, 1);          // cool nights
  const uv = clamp((env.light - 600) / 400, 0, 1);         // strong light
  const lightStress = clamp((env.light - 850) / 150, 0, 1);// extreme light
  const drought = clamp((45 - env.water) / 45, 0, 1);      // dry root zone
  const humid = clamp((env.humidity - 60) / 30, 0, 1);     // damp canopy

  // How purple-capable the strain already is (share of purple-band palette weight).
  const totalW = base.palette.reduce((s, p) => s + p.weight, 0) || 1;
  const purpleW = base.palette.filter((p) => p.hue >= PURPLE_LO && p.hue <= PURPLE_HI).reduce((s, p) => s + p.weight, 0);
  const purpleCap = purpleW / totalW;

  const palette = base.palette.map((p) => ({ ...p }));
  if (cool > 0.05) {
    // Subtle purple edges/shadows first; strongest on purple-capable strains.
    palette.push({ hue: 274, sat: 56, lit: 30, weight: cool * (0.4 + 2.6 * purpleCap) });
    if (purpleCap > 0.2) palette.push({ hue: 286, sat: 58, lit: 41, weight: cool * 1.5 * purpleCap });
  }
  if (drought > 0.1) for (const p of palette) p.lit = Math.max(8, p.lit - drought * 6); // darker greens

  return {
    ...base,
    palette,
    maxBudWidth: base.maxBudWidth * (1 - drought * 0.12),      // drought → tighter cola
    calyxSizeMin: base.calyxSizeMin * (1 - drought * 0.15),     // drought → smaller calyxes
    calyxSizeMax: base.calyxSizeMax * (1 - drought * 0.15),
    overlap: clamp(base.overlap - drought * 0.05, 0.5, 0.8),    // drought → less plump
    trichomeDensity: clamp(base.trichomeDensity + uv * 0.25, 0, 1), // UV → frostier
    foxtailBias: clamp(lightStress * 0.55, 0, 1),               // light stress → foxtails
    topStretch: clamp(lightStress * 0.7, 0, 1),                 // light stress → stretched top
    highlightBoost: clamp(uv * 0.6, 0, 1),                      // UV → brighter highlights
    moldRisk: clamp(humid, 0, 1),                               // humidity → hidden risk
  };
}
