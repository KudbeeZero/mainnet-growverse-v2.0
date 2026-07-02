// Fan leaf geometry builder (pure, DOM-free).
//
// Generates a cannabis fan leaf as a flat palmate shape: a central leaflet flanked
// by 2-4 pairs of side leaflets, each serrated. The geometry is a flat XY plane
// (pointing +Y) suitable for instancing. The number of leaflets (3, 5, 7, 9)
// varies with maturity; indica leaves are wider, sativa are narrow and elongated.

export interface LeafGeometry {
  /** Flat vertex positions [x, y, z, x, y, z, ...] */
  vertices: Float32Array;
  /** Triangle indices */
  indices: Uint16Array;
  /** Per-vertex colours [r, g, b, ...] — midrib darker, tips lighter. */
  colors: Float32Array;
}

export interface LeafOpts {
  /** Number of leaflets: 3, 5, 7, or 9. */
  leaflets: number;
  /** Leaf width multiplier (indica ≈ 1.3, sativa ≈ 0.6). */
  widthMul: number;
  /** Base green hue (0..360). */
  hue: number;
  /** Saturation (0..100). */
  sat: number;
  /** Lightness (0..100). */
  lit: number;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hh = ((h % 360) + 360) % 360 / 360;
  const ss = Math.min(1, Math.max(0, s / 100));
  const ll = Math.min(1, Math.max(0, l / 100));
  if (ss === 0) return [ll, ll, ll];
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p = 2 * ll - q;
  const hk = (t: number) => {
    let tc = t;
    if (tc < 0) tc += 1;
    if (tc > 1) tc -= 1;
    if (tc < 1 / 6) return p + (q - p) * 6 * tc;
    if (tc < 1 / 2) return q;
    if (tc < 2 / 3) return p + (q - p) * (2 / 3 - tc) * 6;
    return p;
  };
  return [hk(hh + 1 / 3), hk(hh), hk(hh - 1 / 3)];
}

/**
 * Build one serrated LANCEOLATE leaflet as a list of 2D points (XY), tip at the
 * top. Narrow width:length ratio (real cannabis leaflets run ~1:6-1:8) and many
 * fine teeth — a cannabis leaflet has a long, deeply serrated edge, not a few
 * big scallops. Returns the outline going up the right side, across the tip,
 * and back down the left side.
 */
// Width envelope: a quick smoothstep rise to full width by ~22% up the blade,
// then a LONG near-linear taper to an exact zero at the tip. A sine falls off
// like a cosine near t=1 — tangentially, never truly pointed — which is why
// the old outline read as a soft, slightly rounded hand leaf. This one reaches
// width 0 with a real slope, so the tip reads as a genuine lance point.
function leafletEnvelope(t: number): number {
  const rise = 0.22;
  if (t < rise) {
    const k = t / rise;
    return k * k * (3 - 2 * k); // smoothstep 0→1
  }
  const tt = (t - rise) / (1 - rise);
  return Math.pow(1 - tt, 1.12);
}

function leafletOutline(
  length: number,
  width: number,
  teeth: number,
): [number, number][] {
  const pts: [number, number][] = [];
  pts.push([0, 0]);
  const teethCount = Math.max(5, teeth);
  for (let i = 0; i < teethCount; i++) {
    const t = (i + 0.5) / teethCount;
    const y = t * length;
    const w = width * leafletEnvelope(t);
    // Deeper, sharper serration notches than before — a crisply toothed edge
    // instead of a soft scalloped one.
    const toothDepth = w * 0.3;
    pts.push([w + toothDepth * 0.5, y - length * 0.01]);
    pts.push([w - toothDepth * 0.5, y + length * 0.01]);
  }
  pts.push([0, length]);
  for (let i = teethCount - 1; i >= 0; i--) {
    const t = (i + 0.5) / teethCount;
    const y = t * length;
    const w = width * leafletEnvelope(t);
    const toothDepth = w * 0.3;
    pts.push([-w + toothDepth * 0.5, y + length * 0.01]);
    pts.push([-w - toothDepth * 0.5, y - length * 0.01]);
  }
  return pts;
}

/**
 * Build a cannabis fan leaf geometry with the given number of leaflets.
 *
 * The leaf is centered at the petiole (base), pointing +Y. It spans about
 * 1 unit tall in its default form; the renderer scales it per-placement.
 *
 * Returns triangulated vertex data ready for three.js BufferGeometry.
 */
export function buildFanLeaf(opts: LeafOpts): LeafGeometry {
  const nLeaflets = Math.min(9, Math.max(3, opts.leaflets | 1)); // force odd
  const pairs = (nLeaflets - 1) / 2;
  const wMul = opts.widthMul;
  const [baseR, baseG, baseB] = hslToRgb(opts.hue, opts.sat, opts.lit);

  const allVerts: number[] = [];
  const allIndices: number[] = [];
  const allColors: number[] = [];

  // Petiole (stem) — a short segment before the leaflets fan out. EVERY leaflet
  // radiates from the SAME point at its tip (palmately compound — fingers from
  // one palm), not from staggered points up the stem; that shared origin plus a
  // wide angular spread is what separates the leaflets into a real hand shape
  // instead of one fused paddle.
  const petioleLen = 0.12;
  const originY = petioleLen;

  // Central leaflet — the longest, points straight up (angle 0). Longer and
  // markedly narrower than before (lance-shaped, not a broad hand blade) —
  // unmistakably a cannabis leaflet in silhouette alone.
  const centralLen = 0.82;
  const centralW = 0.082 * wMul;
  const centralTeeth = 10 + pairs * 2;

  // Angular spread per pair, widening toward the outer leaflets (a real fan leaf's
  // outermost pair splays far out / slightly down, not bunched near the center).
  // Wider than before so narrower blades still read as clearly separated fingers.
  const ANGLE_STEPS = [0, 0.54, 0.98, 1.3, 1.52]; // radians, index = pair number
  // Outer leaflets shrink faster than a linear falloff (short "pinky" leaflets) —
  // a steeper natural taper than before so the centre leaflet unmistakably reads
  // as the longest.
  const LEN_STEPS = [1, 0.8, 0.6, 0.42, 0.28];

  function addLeaflet(len: number, width: number, teeth: number, angle: number) {
    const outline = leafletOutline(len, width, teeth);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const baseIdx = allVerts.length / 3;

    // Centroid for the triangle fan.
    const rcx = sin * len * 0.42;
    const rcy = originY + cos * len * 0.42;
    allVerts.push(rcx, rcy, 0);
    allColors.push(baseR * 0.9, Math.min(1, baseG * 0.94), baseB * 0.84);

    for (let i = 0; i < outline.length; i++) {
      const [ox, oy] = outline[i];
      // Rotate the outline about the SHARED origin (petiole tip).
      const rx = cos * ox + sin * oy;
      const ry = originY + (-sin * ox + cos * oy);
      allVerts.push(rx, ry, 0);
      const tf = oy / len;
      allColors.push(
        Math.min(1, baseR * (0.84 + 0.2 * tf)),
        Math.min(1, baseG * (0.89 + 0.16 * tf)),
        Math.min(1, baseB * (0.79 + 0.26 * tf)),
      );
      if (i > 0) allIndices.push(baseIdx, baseIdx + i, baseIdx + i + 1);
    }
    allIndices.push(baseIdx, baseIdx + outline.length, baseIdx + 1);
  }

  addLeaflet(centralLen, centralW, centralTeeth, 0);

  // Side leaflets — progressively shorter AND wider-angled outward, each pair
  // symmetric about the central leaflet.
  for (let p = 1; p <= pairs; p++) {
    const leafletLen = centralLen * LEN_STEPS[p];
    const leafletW = centralW * (0.82 - 0.04 * p);
    const teeth = Math.max(4, centralTeeth - p * 2);
    const angle = ANGLE_STEPS[p] * (wMul > 1 ? 0.88 : 1.08); // indica: tighter fan; sativa: wider
    for (const sideSign of [-1, 1]) {
      addLeaflet(leafletLen, leafletW, teeth, sideSign * angle);
    }
  }

  // Petiole triangles (a simple quad from origin to the attachment point).
  const pIdx = allVerts.length / 3;
  const pw = 0.012;
  allVerts.push(-pw, 0, 0, pw, 0, 0, pw, petioleLen, 0, -pw, petioleLen, 0);
  const stemCol: [number, number, number] = [baseR * 0.7, baseG * 0.75, baseB * 0.6];
  for (let j = 0; j < 4; j++) allColors.push(...stemCol);
  allIndices.push(pIdx, pIdx + 1, pIdx + 2, pIdx, pIdx + 2, pIdx + 3);

  return {
    vertices: new Float32Array(allVerts),
    indices: new Uint16Array(allIndices),
    colors: new Float32Array(allColors),
  };
}
