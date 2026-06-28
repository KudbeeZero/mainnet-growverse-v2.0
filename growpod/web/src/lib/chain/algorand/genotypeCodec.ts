// Genotype hex codec — a compact, portable, on-chain-friendly DNA string.
//
// 32 bytes → 64 hex chars. Layout (byte ranges; each gene pair = 2 alleles = 2 bytes):
//   bytes  0-7   yield      (4 gene pairs)   → hex chars 0-15
//   bytes  8-15  potency    (4 gene pairs)   → hex chars 16-31
//   bytes 16-23  speed      (4 gene pairs)   → hex chars 32-47
//   bytes 24-27  resistance (2 gene pairs)   → hex chars 48-55
//   bytes 28-29  anthocyanin(1 gene pair)    → hex chars 56-59
//   byte  30     mutation flags bitmask       → hex chars 60-61
//   byte  31     XOR checksum of bytes 0..30  → hex chars 62-63
//
// Each allele is a byte (0..255). Pure + deterministic — safe to put in NFT metadata.

export interface GenePair {
  a: number;
  b: number;
}

export interface PlantTraits {
  yield: GenePair[]; // 4 pairs
  potency: GenePair[]; // 4 pairs
  speed: GenePair[]; // 4 pairs
  resistance: GenePair[]; // 2 pairs
  anthocyanin: GenePair; // 1 pair
  mutationFlags: number; // 0..255
}

const LOCI = { yield: 4, potency: 4, speed: 4, resistance: 2 } as const;
const TOTAL_BYTES = 32;

const byte = (n: number) => Math.max(0, Math.min(255, Math.round(n))) & 0xff;
const hex2 = (n: number) => byte(n).toString(16).padStart(2, "0");

function pairsToBytes(pairs: GenePair[], count: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const p = pairs[i] ?? { a: 0, b: 0 };
    out.push(byte(p.a), byte(p.b));
  }
  return out;
}

/** Encode traits to a 64-char hex genotype (with trailing XOR checksum byte). */
export function encodeGenotype(traits: PlantTraits): string {
  const bytes: number[] = [
    ...pairsToBytes(traits.yield, LOCI.yield),
    ...pairsToBytes(traits.potency, LOCI.potency),
    ...pairsToBytes(traits.speed, LOCI.speed),
    ...pairsToBytes(traits.resistance, LOCI.resistance),
    ...pairsToBytes([traits.anthocyanin], 1),
    byte(traits.mutationFlags),
  ];
  // bytes now has 31 entries (0..30); append the XOR checksum as byte 31.
  let checksum = 0;
  for (const b of bytes) checksum ^= b;
  bytes.push(checksum & 0xff);
  return bytes.map(hex2).join("");
}

function readPairs(bytes: number[], start: number, count: number): GenePair[] {
  const out: GenePair[] = [];
  for (let i = 0; i < count; i++) out.push({ a: bytes[start + i * 2], b: bytes[start + i * 2 + 1] });
  return out;
}

/** Parse a 64-char hex genotype back into traits. Throws on malformed/!checksum. */
export function decodeGenotype(hex: string): PlantTraits {
  if (!validateGenotype(hex)) throw new Error("Invalid genotype hex");
  const bytes: number[] = [];
  for (let i = 0; i < TOTAL_BYTES; i++) bytes.push(parseInt(hex.slice(i * 2, i * 2 + 2), 16));
  return {
    yield: readPairs(bytes, 0, LOCI.yield),
    potency: readPairs(bytes, 8, LOCI.potency),
    speed: readPairs(bytes, 16, LOCI.speed),
    resistance: readPairs(bytes, 24, LOCI.resistance),
    anthocyanin: readPairs(bytes, 28, 1)[0],
    mutationFlags: bytes[30],
  };
}

/** True iff hex is 64 chars, all hex, and the trailing checksum byte matches. */
export function validateGenotype(hex: string): boolean {
  if (typeof hex !== "string" || !/^[0-9a-fA-F]{64}$/.test(hex)) return false;
  const bytes: number[] = [];
  for (let i = 0; i < TOTAL_BYTES; i++) bytes.push(parseInt(hex.slice(i * 2, i * 2 + 2), 16));
  let checksum = 0;
  for (let i = 0; i < TOTAL_BYTES - 1; i++) checksum ^= bytes[i];
  return (checksum & 0xff) === bytes[TOTAL_BYTES - 1];
}

function meanAllele(pairs: GenePair[]): number {
  if (!pairs.length) return 0;
  const sum = pairs.reduce((acc, p) => acc + p.a + p.b, 0);
  return sum / (pairs.length * 2) / 255; // 0..1
}

/** A human label like "G13-A2B4-FROST-HEAVY" derived from the genotype. */
export function genotypeToDisplayName(hex: string, strain = "STRAIN"): string {
  const t = decodeGenotype(hex);
  const code = `${hex2(t.yield[0].a)}${hex2(t.potency[0].a)}`.toUpperCase();
  const potency = meanAllele(t.potency);
  const tier =
    potency >= 0.75 ? "FROST-HEAVY" : potency >= 0.55 ? "FROST" : potency >= 0.3 ? "BALANCED" : "MELLOW";
  const slug = strain.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${slug}-${code}-${tier}`;
}

/** Deterministic traits from a numeric seed — used when minting from a plant id
 *  alone (no explicit trait vector handy). Same seed → same genotype every time. */
export function traitsFromSeed(seed: number): PlantTraits {
  let s = seed >>> 0;
  const next = () => {
    s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 1) >>> 0;
    return s & 0xff;
  };
  const pairs = (n: number): GenePair[] => Array.from({ length: n }, () => ({ a: next(), b: next() }));
  return {
    yield: pairs(LOCI.yield),
    potency: pairs(LOCI.potency),
    speed: pairs(LOCI.speed),
    resistance: pairs(LOCI.resistance),
    anthocyanin: { a: next(), b: next() },
    mutationFlags: next(),
  };
}
