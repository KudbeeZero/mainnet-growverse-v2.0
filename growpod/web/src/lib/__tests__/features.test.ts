import { describe, it, expect } from "vitest";
import { computeFeatures } from "@/lib/features";

describe("computeFeatures", () => {
  it("defaults every non-MVP feature OFF when env is empty", () => {
    expect(computeFeatures({})).toEqual({
      marketplace: false,
      chain: false,
      cup: false,
      university: false,
      contracts: false,
    });
  });

  it('treats only the exact string "true" as enabled', () => {
    const f = computeFeatures({
      NEXT_PUBLIC_ENABLE_MARKETPLACE: "true",
      NEXT_PUBLIC_ENABLE_CHAIN: "TRUE",
      NEXT_PUBLIC_ENABLE_CUP: "1",
      NEXT_PUBLIC_ENABLE_UNIVERSITY: "yes",
      NEXT_PUBLIC_ENABLE_CONTRACTS: "false",
    });
    expect(f.marketplace).toBe(true);
    expect(f.chain).toBe(false);
    expect(f.cup).toBe(false);
    expect(f.university).toBe(false);
    expect(f.contracts).toBe(false);
  });

  it("enables features independently", () => {
    const f = computeFeatures({ NEXT_PUBLIC_ENABLE_CUP: "true" });
    expect(f.cup).toBe(true);
    expect(f.marketplace).toBe(false);
  });
});
