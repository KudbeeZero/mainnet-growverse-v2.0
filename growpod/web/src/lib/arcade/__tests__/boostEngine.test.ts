import { describe, it, expect, beforeEach } from "vitest";
import { useBoostStore, BOOST_CONFIG } from "@/lib/arcade/boostEngine";

function reset() {
  useBoostStore.setState({ activeBoost: null, boostMultiplier: 1, boostExpiresAt: 0, boostHistory: [] });
}

describe("boostEngine", () => {
  beforeEach(reset);

  it("applying a boost sets the active type, multiplier and a future expiry", () => {
    const { applyBoost, getMultiplier } = useBoostStore.getState();
    applyBoost("NUTRIENT_SURGE");
    const s = useBoostStore.getState();
    expect(s.activeBoost).toBe("NUTRIENT_SURGE");
    expect(s.boostMultiplier).toBe(BOOST_CONFIG.NUTRIENT_SURGE.multiplier);
    expect(s.boostExpiresAt).toBeGreaterThan(Date.now());
    expect(getMultiplier()).toBe(2);
  });

  it("re-applying the same type stacks duration", () => {
    const { applyBoost } = useBoostStore.getState();
    applyBoost("NUTRIENT_SURGE");
    const first = useBoostStore.getState().boostExpiresAt;
    applyBoost("NUTRIENT_SURGE");
    expect(useBoostStore.getState().boostExpiresAt).toBe(first + BOOST_CONFIG.NUTRIENT_SURGE.durationMs);
  });

  it("a stronger boost replaces a weaker active one", () => {
    const { applyBoost } = useBoostStore.getState();
    applyBoost("MYCORRHIZAL_POP"); // 1.5x
    applyBoost("LIGHT_BLAST"); // 3x
    const s = useBoostStore.getState();
    expect(s.activeBoost).toBe("LIGHT_BLAST");
    expect(s.boostMultiplier).toBe(3);
  });

  it("a weaker boost is ignored while a stronger one is active", () => {
    const { applyBoost } = useBoostStore.getState();
    applyBoost("LIGHT_BLAST"); // 3x
    applyBoost("NUTRIENT_SURGE"); // 2x — should not override
    const s = useBoostStore.getState();
    expect(s.activeBoost).toBe("LIGHT_BLAST");
    expect(s.boostMultiplier).toBe(3);
  });

  it("getMultiplier returns 1 once the boost has expired", () => {
    const { applyBoost, getMultiplier } = useBoostStore.getState();
    applyBoost("LIGHT_BLAST");
    useBoostStore.setState({ boostExpiresAt: Date.now() - 1 });
    expect(getMultiplier()).toBe(1);
  });

  it("history is capped at 50 entries", () => {
    const { applyBoost } = useBoostStore.getState();
    for (let i = 0; i < 60; i++) applyBoost("ROOT_JUICE");
    expect(useBoostStore.getState().boostHistory.length).toBe(50);
  });

  it("clearBoost resets to the idle state", () => {
    const { applyBoost, clearBoost } = useBoostStore.getState();
    applyBoost("LIGHT_BLAST");
    clearBoost();
    const s = useBoostStore.getState();
    expect(s.activeBoost).toBeNull();
    expect(s.boostMultiplier).toBe(1);
    expect(s.boostExpiresAt).toBe(0);
  });
});
