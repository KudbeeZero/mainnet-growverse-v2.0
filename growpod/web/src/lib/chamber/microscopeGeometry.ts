// Pure geometry + maturity colour for the Trichome Microscope bud.
//
// Extracted from the Microscope canvas component so the deterministic layout and
// the clear→cloudy→amber colour ramp can be unit-tested (the canvas drawing
// itself stays in the component). Same seed ⇒ same bud, every render.

export const WORLD = 1000;

export function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Trichome {
  x: number;
  y: number;
  stalk: number;
  head: number;
  matJitter: number;
  terp: number; // index into terpenes, or -1
  glint: number;
  /** Ovoid x/y ratio so heads read as bulbous glands, not perfect circles. */
  ox: number;
  /** Stalk tilt in radians (±) so the field looks organic, not a pin-grid. */
  tilt: number;
  /** Rotation for the far-view crystal speck. */
  rot: number;
}
export interface Calyx {
  x: number;
  y: number;
  rx: number;
  ry: number;
  rot: number;
  shade: number;
  /** Teardrop skew so calyxes bulge instead of reading as pebbles. */
  skew: number;
}
export interface Pistil {
  x: number;
  y: number;
  ang: number;
  len: number;
  curl: number;
  amber: number;
  /** Base stroke width; the hair tapers to a fine tip from here. */
  baseW: number;
}
export interface Geometry {
  calyxes: Calyx[];
  trichomes: Trichome[];
  pistils: Pistil[];
}

/** Counts are exported so tests can assert the layout is stable. */
export const CALYX_COUNT = 70;
export const TRICHOME_COUNT = 620;
export const PISTIL_COUNT = 46;

export function buildBudGeometry(seed: number, terpCount: number): Geometry {
  const rnd = mulberry32(seed || 1);
  const cx = WORLD / 2;
  const cy = WORLD / 2;
  // Bud silhouette: a vertical-ish cluster of overlapping calyx blobs.
  const radX = WORLD * 0.32;
  const radY = WORLD * 0.4;
  const inBud = (x: number, y: number) => {
    const dx = (x - cx) / radX;
    const dy = (y - cy) / radY;
    return dx * dx + dy * dy <= 1;
  };

  const calyxes: Calyx[] = [];
  for (let i = 0; i < CALYX_COUNT; i++) {
    let x = 0;
    let y = 0;
    for (let t = 0; t < 8; t++) {
      x = cx + (rnd() * 2 - 1) * radX;
      y = cy + (rnd() * 2 - 1) * radY;
      if (inBud(x, y)) break;
    }
    const r = 60 + rnd() * 70;
    calyxes.push({
      x,
      y,
      rx: r,
      ry: r * (0.7 + rnd() * 0.5),
      rot: rnd() * Math.PI,
      shade: rnd(),
      skew: 0.8 + rnd() * 0.4,
    });
  }

  const trichomes: Trichome[] = [];
  for (let i = 0; i < TRICHOME_COUNT; i++) {
    let x = 0;
    let y = 0;
    for (let t = 0; t < 8; t++) {
      x = cx + (rnd() * 2 - 1) * radX * 0.98;
      y = cy + (rnd() * 2 - 1) * radY * 0.98;
      if (inBud(x, y)) break;
    }
    const head = 5 + rnd() * 6;
    trichomes.push({
      x,
      y,
      stalk: head * (1.4 + rnd() * 1.6),
      head,
      matJitter: rnd() * 0.5 - 0.2,
      terp: terpCount > 0 && rnd() < 0.55 ? Math.floor(rnd() * terpCount) : -1,
      glint: rnd(),
      ox: 0.78 + rnd() * 0.44,
      tilt: (rnd() * 2 - 1) * 0.22,
      rot: rnd() * Math.PI,
    });
  }

  const pistils: Pistil[] = [];
  for (let i = 0; i < PISTIL_COUNT; i++) {
    let x = 0;
    let y = 0;
    for (let t = 0; t < 8; t++) {
      x = cx + (rnd() * 2 - 1) * radX * 0.8;
      y = cy + (rnd() * 2 - 1) * radY * 0.8;
      if (inBud(x, y)) break;
    }
    pistils.push({
      x,
      y,
      ang: rnd() * Math.PI * 2,
      len: 70 + rnd() * 130,
      curl: (rnd() * 2 - 1) * 0.9,
      amber: rnd(),
      baseW: 2.6 + rnd() * 1.8,
    });
  }

  return { calyxes, trichomes, pistils };
}

/** Trichome head colour by maturity: 0 clear (bluish glass) → 0.5 cloudy
 *  (milky) → 1 amber (gold). Returns an rgba() string. */
export function headColor(m: number): string {
  const c = Math.max(0, Math.min(1, m));
  if (c < 0.5) {
    const t = c / 0.5;
    const r = Math.round(205 + t * 30);
    const g = Math.round(225 + t * 20);
    const b = Math.round(235 - t * 35);
    return `rgba(${r},${g},${b},0.92)`;
  }
  const t = (c - 0.5) / 0.5;
  const r = Math.round(235 + t * 18);
  const g = Math.round(220 - t * 70);
  const b = Math.round(170 - t * 120);
  return `rgba(${r},${g},${b},0.95)`;
}

/** Far-view frost opacity: clear trichomes are faint, cloudy/amber ones frost
 *  the bud up — so dragging the maturity slider visibly changes the bud at 1×. */
export function frostAlpha(m: number): number {
  const c = Math.max(0, Math.min(1, m));
  return c < 0.3 ? 0.4 : c > 0.7 ? 0.72 : 0.55;
}
