import { describe, it, expect } from "vitest";
import {
  encodeGenotype,
  decodeGenotype,
  validateGenotype,
  genotypeToDisplayName,
  traitsFromSeed,
  type PlantTraits,
} from "@/lib/chain/algorand/genotypeCodec";

const SAMPLE: PlantTraits = {
  yield: [
    { a: 10, b: 20 },
    { a: 30, b: 40 },
    { a: 50, b: 60 },
    { a: 70, b: 80 },
  ],
  potency: [
    { a: 200, b: 210 },
    { a: 220, b: 230 },
    { a: 240, b: 250 },
    { a: 255, b: 255 },
  ],
  speed: [
    { a: 1, b: 2 },
    { a: 3, b: 4 },
    { a: 5, b: 6 },
    { a: 7, b: 8 },
  ],
  resistance: [
    { a: 100, b: 110 },
    { a: 120, b: 130 },
  ],
  anthocyanin: { a: 140, b: 150 },
  mutationFlags: 0b1010,
};

describe("genotypeCodec", () => {
  it("encodes to a valid 64-char hex string", () => {
    const hex = encodeGenotype(SAMPLE);
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
    expect(validateGenotype(hex)).toBe(true);
  });

  it("round-trips encode → decode losslessly", () => {
    const hex = encodeGenotype(SAMPLE);
    expect(decodeGenotype(hex)).toEqual(SAMPLE);
  });

  it("rejects a corrupted checksum", () => {
    const hex = encodeGenotype(SAMPLE);
    // Flip the last checksum nibble.
    const bad = hex.slice(0, 63) + (hex[63] === "0" ? "1" : "0");
    expect(validateGenotype(bad)).toBe(false);
    expect(() => decodeGenotype(bad)).toThrow();
  });

  it("rejects wrong-length / non-hex input", () => {
    expect(validateGenotype("abc")).toBe(false);
    expect(validateGenotype("z".repeat(64))).toBe(false);
  });

  it("builds a strain display name with a quality tier", () => {
    const hex = encodeGenotype(SAMPLE);
    const name = genotypeToDisplayName(hex, "G13");
    expect(name.startsWith("G13-")).toBe(true);
    // High potency sample → FROST-HEAVY tier.
    expect(name.endsWith("FROST-HEAVY")).toBe(true);
  });

  it("traitsFromSeed is deterministic and encodes cleanly", () => {
    const a = encodeGenotype(traitsFromSeed(12345));
    const b = encodeGenotype(traitsFromSeed(12345));
    const c = encodeGenotype(traitsFromSeed(99999));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(validateGenotype(a)).toBe(true);
  });
});
