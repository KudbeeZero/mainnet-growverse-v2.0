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
 * Build one serrated leaflet as a list of 2D points (XY), tip at the top.
 * Returns the outline going up the right side, across the tip, and back down
 * the left side.
 */
function leafletOutline(
  length: number,
  width: number,
  teeth: number,
): [number, number][] {
  const pts: [number, number][] = [];
  // Right side going up
  pts.push([0, 0]);
  const teethCount = Math.max(2, teeth);
  for (let i = 0; i < teethCount; i++) {
    const t = (i + 0.5) / teethCount;
    const y = t * length;
    // Leaflet is widest around 30-40% up, then tapers to the tip.
    const envelope = Math.sin(Math.PI * (0.15 + 0.7 * t));
    const w = width * envelope;
    const toothDepth = w * 0.18;
    // Outer point of serration
    pts.push([w + toothDepth * 0.5, y - length * 0.02]);
    // Inner notch
    pts.push([w - toothDepth * 0.5, y + length * 0.02]);
  }
  // Tip
  pts.push([0, length]);
  // Left side going down (mirror)
  for (let i = teethCount - 1; i >= 0; i--) {
    const t = (i + 0.5) / teethCount;
    const y = t * length;
    const envelope = Math.sin(Math.PI * (0.15 + 0.7 * t));
    const w = width * envelope;
    const toothDepth = w * 0.18;
    pts.push([-w + toothDepth * 0.5, y + length * 0.02]);
    pts.push([-w - toothDepth * 0.5, y - length * 0.02]);
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

  // Petiole (stem) — a short segment before the leaflets fan out.
  const petioleLen = 0.12;

  // Central leaflet — the longest.
  const centralLen = 0.7;
  const centralW = 0.08 * wMul;
  const centralTeeth = 5 + pairs;
  const centralOutline = leafletOutline(centralLen, centralW, centralTeeth);

  // Triangulate the central leaflet as a triangle fan from centroid.
  const cCx = 0, cCy = petioleLen + centralLen * 0.4;
  const baseIdx = allVerts.length / 3;
  // Add centroid
  allVerts.push(cCx, cCy, 0);
  const midColor = Math.min(1, baseG * 0.95);
  allColors.push(baseR * 0.9, midColor, baseB * 0.85);

  for (let i = 0; i < centralOutline.length; i++) {
    const [ox, oy] = centralOutline[i];
    allVerts.push(ox, oy + petioleLen, 0);
    // Tips lighter, base darker.
    const tf = oy / centralLen;
    allColors.push(
      Math.min(1, baseR * (0.85 + 0.2 * tf)),
      Math.min(1, baseG * (0.9 + 0.15 * tf)),
      Math.min(1, baseB * (0.8 + 0.25 * tf)),
    );
    if (i > 0) {
      allIndices.push(baseIdx, baseIdx + i, baseIdx + i + 1);
    }
  }
  // Close the fan
  allIndices.push(baseIdx, baseIdx + centralOutline.length, baseIdx + 1);

  // Side leaflets — progressively shorter, angled outward.
  for (let p = 1; p <= pairs; p++) {
    const pairFrac = p / (pairs + 1);
    const leafletLen = centralLen * (0.9 - 0.2 * pairFrac);
    const leafletW = centralW * (0.85 + 0.1 * (wMul > 1 ? 1 : 0));
    const teeth = Math.max(3, centralTeeth - p);
    const angle = (0.25 + 0.35 * pairFrac) * (wMul > 1 ? 1.1 : 0.9);
    const attachY = petioleLen * (0.6 - 0.15 * pairFrac);

    for (const sideSign of [-1, 1]) {
      const outline = leafletOutline(leafletLen, leafletW, teeth);
      const cos = Math.cos(sideSign * angle);
      const sin = Math.sin(sideSign * angle);

      const sBaseIdx = allVerts.length / 3;
      // Centroid of this leaflet (rotated)
      const rcx = sin * leafletLen * 0.4;
      const rcy = attachY + cos * leafletLen * 0.4;
      allVerts.push(rcx, rcy, 0);
      allColors.push(baseR * 0.88, Math.min(1, baseG * 0.92), baseB * 0.82);

      for (let i = 0; i < outline.length; i++) {
        const [ox, oy] = outline[i];
        const rx = cos * ox + sin * oy;
        const ry = attachY + (-sin * ox + cos * oy);
        allVerts.push(rx, ry, 0);
        const tf = oy / leafletLen;
        allColors.push(
          Math.min(1, baseR * (0.82 + 0.22 * tf)),
          Math.min(1, baseG * (0.88 + 0.17 * tf)),
          Math.min(1, baseB * (0.78 + 0.27 * tf)),
        );
        if (i > 0) {
          allIndices.push(sBaseIdx, sBaseIdx + i, sBaseIdx + i + 1);
        }
      }
      allIndices.push(sBaseIdx, sBaseIdx + outline.length, sBaseIdx + 1);
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
