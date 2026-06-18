import { describe, it, expect } from "vitest";
import { computeFeatures } from "@/lib/features";

describe("computeFeatures", () => {
  it("defaults every surface ON when env is empty (testing/playtest build)", () => {
    expect(computeFeatures({})).toEqual({
      marketplace: true,
      chain: true,
      cup: true,
      university: true,
      contracts: true,
    });
  });

  it('disables only on the exact string "false" (launch per-env OFF)', () => {
    const f = computeFeatures({
      NEXT_PUBLIC_ENABLE_MARKETPLACE: "false",
      NEXT_PUBLIC_ENABLE_CHAIN: "true",
      NEXT_PUBLIC_ENABLE_CUP: "1",
      NEXT_PUBLIC_ENABLE_UNIVERSITY: "",
      NEXT_PUBLIC_ENABLE_CONTRACTS: "yes",
    });
    expect(f.marketplace).toBe(false); // explicitly disabled
    expect(f.chain).toBe(true);
    expect(f.cup).toBe(true); // any non-"false" value stays ON
    expect(f.university).toBe(true);
    expect(f.contracts).toBe(true);
  });

  it("disables features independently", () => {
    const f = computeFeatures({ NEXT_PUBLIC_ENABLE_CUP: "false" });
    expect(f.cup).toBe(false);
    expect(f.marketplace).toBe(true);
  });
});
