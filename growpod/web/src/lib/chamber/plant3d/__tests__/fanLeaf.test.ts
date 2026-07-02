import { describe, it, expect } from "vitest";
import { buildFanLeaf } from "@/lib/chamber/plant3d/fanLeaf";

describe("buildFanLeaf", () => {
  it("returns non-empty geometry", () => {
    const leaf = buildFanLeaf({ leaflets: 7, widthMul: 1.0, hue: 120, sat: 50, lit: 35 });
    expect(leaf.vertices.length).toBeGreaterThan(0);
    expect(leaf.indices.length).toBeGreaterThan(0);
    expect(leaf.colors.length).toBe(leaf.vertices.length);
  });

  it("produces more vertices for more leaflets", () => {
    const leaf3 = buildFanLeaf({ leaflets: 3, widthMul: 1.0, hue: 120, sat: 50, lit: 35 });
    const leaf9 = buildFanLeaf({ leaflets: 9, widthMul: 1.0, hue: 120, sat: 50, lit: 35 });
    expect(leaf9.vertices.length).toBeGreaterThan(leaf3.vertices.length);
  });

  it("vertex colours are in 0..1 range", () => {
    const leaf = buildFanLeaf({ leaflets: 7, widthMul: 1.0, hue: 120, sat: 50, lit: 35 });
    for (let i = 0; i < leaf.colors.length; i++) {
      expect(leaf.colors[i]).toBeGreaterThanOrEqual(0);
      expect(leaf.colors[i]).toBeLessThanOrEqual(1);
    }
  });

  it("indices reference valid vertices", () => {
    const leaf = buildFanLeaf({ leaflets: 5, widthMul: 1.0, hue: 120, sat: 50, lit: 35 });
    const vertCount = leaf.vertices.length / 3;
    for (let i = 0; i < leaf.indices.length; i++) {
      expect(leaf.indices[i]).toBeLessThan(vertCount);
    }
  });

  it("forces odd leaflet count", () => {
    const leaf4 = buildFanLeaf({ leaflets: 4, widthMul: 1.0, hue: 120, sat: 50, lit: 35 });
    const leaf5 = buildFanLeaf({ leaflets: 5, widthMul: 1.0, hue: 120, sat: 50, lit: 35 });
    expect(leaf4.vertices.length).toBe(leaf5.vertices.length);
  });
});
