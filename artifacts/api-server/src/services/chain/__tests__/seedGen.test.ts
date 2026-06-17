import { deriveSeedTraits } from "../seedGen";

const BLOCK = "ABCDEF0123456789BLOCKHASH";
const ADDR = "FRONTIERPLAYERADDRESS7XYZ";
const NONCE = "11111111-2222-3333-4444-555555555555";

describe("deriveSeedTraits", () => {
  it("is deterministic — identical inputs produce identical traits", () => {
    const a = deriveSeedTraits(BLOCK, ADDR, NONCE);
    const b = deriveSeedTraits(BLOCK, ADDR, NONCE);
    expect(a).toEqual(b);
  });

  it("changes output when the nonce changes (entropy guarantee)", () => {
    const a = deriveSeedTraits(BLOCK, ADDR, NONCE);
    const b = deriveSeedTraits(BLOCK, ADDR, "ffffffff-0000-0000-0000-000000000000");
    expect(a).not.toEqual(b);
  });

  it("changes output when the player address changes", () => {
    const a = deriveSeedTraits(BLOCK, ADDR, NONCE);
    const b = deriveSeedTraits(BLOCK, "DIFFERENTADDRESS", NONCE);
    expect(a).not.toEqual(b);
  });

  it("produces traits within the documented ranges (Section 3.2)", () => {
    // Sample many inputs to exercise the full byte space.
    for (let i = 0; i < 500; i++) {
      const t = deriveSeedTraits(BLOCK, ADDR, `nonce-${i}`);

      expect(["indica", "sativa", "hybrid"]).toContain(t.strainFamily);

      expect(t.growthRate).toBeGreaterThanOrEqual(0.4);
      expect(t.growthRate).toBeLessThanOrEqual(1.8);

      expect(t.internodeSpacing).toBeGreaterThanOrEqual(0.2);
      expect(t.internodeSpacing).toBeLessThanOrEqual(1.0);

      expect(t.leafDensity).toBeGreaterThanOrEqual(0.2);
      expect(t.leafDensity).toBeLessThanOrEqual(1.0);

      expect(t.resinProfile).toBeGreaterThanOrEqual(0.0);
      expect(t.resinProfile).toBeLessThanOrEqual(1.0);

      expect(t.colorShift).toBeGreaterThanOrEqual(0);
      expect(t.colorShift).toBeLessThanOrEqual(360);

      expect(typeof t.mutationFlag).toBe("boolean");
      expect(t.parentSeedId).toBeNull();
    }
  });

  it("matches a known golden vector (locks the byte-slicing math)", () => {
    const t = deriveSeedTraits(BLOCK, ADDR, NONCE);
    // Snapshot of the exact derived values for the fixed inputs above.
    // If the slicing/formula ever changes unintentionally this will fail.
    expect(t).toMatchSnapshot();
  });

  it("mutationFlag fires roughly ~3% of the time across a large sample", () => {
    let hits = 0;
    const N = 5000;
    for (let i = 0; i < N; i++) {
      if (deriveSeedTraits(BLOCK, ADDR, `mut-${i}`).mutationFlag) hits++;
    }
    const rate = hits / N;
    // n(12) < 8 over a byte => 8/256 = 3.125% expected. Allow generous slack.
    expect(rate).toBeGreaterThan(0.01);
    expect(rate).toBeLessThan(0.06);
  });
});
