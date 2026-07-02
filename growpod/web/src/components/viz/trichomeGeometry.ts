// Shared capitate-stalked trichome geometry + resin-head colour.
//
// A real cannabis trichome is a capitate-stalked gland: a thin translucent STALK
// with a bulbous resin GLAND head on top. Both the whole-plant TrichomeLayer and
// the live close-up BudGL render the same micro-mesh so the two views can never
// drift. Geometry is deliberately tiny/low-poly (thousands of instances, one draw
// call) with SMOOTH radial gland normals so it reads as a bead, never a crystal.

import * as THREE from "three";
import type { FrostMat } from "@/lib/chamber/bud3d/detail";

/** Resin-head base colour by maturity (mirrors trichomes.ts trichHeadColor). An
 * optional purple pheno tips clear/cloudy heads slightly lavender (highlight only). */
export function trichomeHeadColor(mat: FrostMat, purple = 0): THREE.Color {
  if (mat === 2) return new THREE.Color(0.9, 0.74, 0.45); // amber — warm cream/gold
  let r: number, g: number, b: number;
  if (mat === 0) { r = 0.88; g = 0.95; b = 1.0; } // clear — blue-white
  else { r = 0.97; g = 0.98; b = 0.955; } // cloudy — milky white
  const t = Math.min(1, Math.max(0, purple)) * 0.35;
  r += (0.78 - r) * t; g += (0.7 - g) * t; b += (0.91 - b) * t;
  return new THREE.Color(r, g, b);
}

/** Merge child geometries (position + normal) into one non-indexed geometry. */
function concatGeom(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const posArr: number[] = [];
  const nrmArr: number[] = [];
  for (const g of parts) {
    const p = g.attributes.position;
    const n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      posArr.push(p.getX(i), p.getY(i), p.getZ(i));
      nrmArr.push(n.getX(i), n.getY(i), n.getZ(i));
    }
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(posArr, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nrmArr, 3));
  return geo;
}

/** A smooth-normal resin gland ball (octahedron shaded radially — a bead, not a
 * crystal), radius `r`, centred at height `y`. `detail` 0 ≈ 8 tris, 1 ≈ 32 tris. */
function glandGeom(r: number, y: number, detail = 0): THREE.BufferGeometry {
  const g = new THREE.OctahedronGeometry(r, detail).toNonIndexed();
  const p = g.attributes.position;
  const n = g.attributes.normal;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize(); // radial => smooth, no facets
    n.setXYZ(i, v.x, v.y, v.z);
  }
  g.translate(0, y, 0);
  return g;
}

/** Capitate stalk + gland, unit height ≈ 1, base at y=0. `detail` bumps the gland
 * subdivision for the close-up bud (whole-plant uses 0 to hold the tri budget). */
export function makeCapitateGeom(detail = 0): THREE.BufferGeometry {
  const stalk = new THREE.CylinderGeometry(0.09, 0.13, 0.52, detail > 0 ? 5 : 3, 1, true).toNonIndexed();
  stalk.translate(0, 0.26, 0);
  stalk.computeVertexNormals();
  return concatGeom([stalk, glandGeom(0.5, 0.62, detail)]);
}

/** Gland head only (mid LOD / cheap sparkle) — no stalk. */
export function makeGlandOnlyGeom(detail = 0): THREE.BufferGeometry {
  return concatGeom([glandGeom(0.55, 0, detail)]);
}
