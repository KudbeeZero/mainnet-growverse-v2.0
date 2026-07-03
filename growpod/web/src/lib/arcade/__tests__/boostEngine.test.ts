import { describe, it, expect, beforeEach } from "vitest";
import { useBoostStore, BOOST_CONFIG } from "@/lib/arcade/boostEngine";

function reset() {
  useBoostStore.setState({
    activeBoost: null,
    boostMultiplier: 1,
    boostExpiresAt: 0,
    boostHistory: [],
    cooldownUntil: {},
  });
}

/** Clear the per-type cooldown clock only — simulates the lockout having lapsed
 *  without touching the active boost (for tests exercising re-apply behavior). */
function lapseCooldowns() {
  useBoostStore.setState({ cooldownUntil: {} });
}

describe("boostEngine", () => {
  beforeEach(reset);

  it("applying a boost sets the active type, multiplier and a future expiry", () => {
    const { applyBoost, getMultiplier } = useBoostStore.getState();
    expect(applyBoost("NUTRIENT_SURGE")).toBe(true);
    const s = useBoostStore.getState();
    expect(s.activeBoost).toBe("NUTRIENT_SURGE");
    expect(s.boostMultiplier).toBe(BOOST_CONFIG.NUTRIENT_SURGE.multiplier);
    expect(s.boostExpiresAt).toBeGreaterThan(Date.now());
    expect(getMultiplier()).toBe(2);
  });

  it("re-applying the same type stacks duration (once its cooldown has lapsed)", () => {
    // Cooldowns moved into the store (lifted from ArcadeHUD's local ref), so a
    // same-type re-apply now requires the lockout to have expired first.
    const { applyBoost } = useBoostStore.getState();
    applyBoost("NUTRIENT_SURGE");
    const first = useBoostStore.getState().boostExpiresAt;
    lapseCooldowns();
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
    expect(applyBoost("NUTRIENT_SURGE")).toBe(false); // 2x — should not override
    const s = useBoostStore.getState();
    expect(s.activeBoost).toBe("LIGHT_BLAST");
    expect(s.boostMultiplier).toBe(3);
  });

  it("a rejected weaker boost does NOT start a cooldown", () => {
    const { applyBoost, getCooldownRemaining } = useBoostStore.getState();
    applyBoost("LIGHT_BLAST"); // 3x active
    applyBoost("NUTRIENT_SURGE"); // rejected — nothing happened
    expect(getCooldownRemaining("NUTRIENT_SURGE")).toBe(0);
  });

  it("getMultiplier returns 1 once the boost has expired", () => {
    const { applyBoost, getMultiplier } = useBoostStore.getState();
    applyBoost("LIGHT_BLAST");
    useBoostStore.setState({ boostExpiresAt: Date.now() - 1 });
    expect(getMultiplier()).toBe(1);
  });

  it("history is capped at 50 entries", () => {
    const { applyBoost } = useBoostStore.getState();
    for (let i = 0; i < 60; i++) {
      lapseCooldowns(); // each loop iteration simulates the 30s lockout passing
      applyBoost("ROOT_JUICE");
    }
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

  // ---- cooldowns in the store (lifted from ArcadeHUD's local useRef) ----

  it("a successful apply starts that type's cooldown", () => {
    const { applyBoost, getCooldownRemaining } = useBoostStore.getState();
    const before = Date.now();
    applyBoost("LIGHT_BLAST");
    const until = useBoostStore.getState().cooldownUntil.LIGHT_BLAST ?? 0;
    expect(until).toBeGreaterThanOrEqual(before + BOOST_CONFIG.LIGHT_BLAST.cooldownMs);
    const rem = getCooldownRemaining("LIGHT_BLAST");
    expect(rem).toBeGreaterThan(0);
    expect(rem).toBeLessThanOrEqual(BOOST_CONFIG.LIGHT_BLAST.cooldownMs);
  });

  it("a type on cooldown is rejected and leaves state untouched", () => {
    const { applyBoost } = useBoostStore.getState();
    applyBoost("LIGHT_BLAST");
    const snap = useBoostStore.getState();
    expect(applyBoost("LIGHT_BLAST")).toBe(false); // still locked out
    const s = useBoostStore.getState();
    expect(s.boostExpiresAt).toBe(snap.boostExpiresAt); // no duration stack
    expect(s.boostHistory.length).toBe(snap.boostHistory.length); // no history entry
  });

  it("cooldowns are per type — one type locked out doesn't block another", () => {
    const { applyBoost, getCooldownRemaining } = useBoostStore.getState();
    applyBoost("MYCORRHIZAL_POP"); // 1.5x, now on cooldown
    expect(getCooldownRemaining("LIGHT_BLAST")).toBe(0);
    expect(applyBoost("LIGHT_BLAST")).toBe(true); // stronger + not on cooldown
  });

  it("getCooldownRemaining returns 0 once the lockout has passed", () => {
    const { applyBoost, getCooldownRemaining } = useBoostStore.getState();
    applyBoost("ROOT_JUICE");
    useBoostStore.setState({ cooldownUntil: { ROOT_JUICE: Date.now() - 1 } });
    expect(getCooldownRemaining("ROOT_JUICE")).toBe(0);
  });

  it("clearBoost does NOT clear cooldowns (no lockout dodging)", () => {
    const { applyBoost, clearBoost, getCooldownRemaining } = useBoostStore.getState();
    applyBoost("LIGHT_BLAST");
    clearBoost();
    expect(getCooldownRemaining("LIGHT_BLAST")).toBeGreaterThan(0);
    expect(useBoostStore.getState().applyBoost("LIGHT_BLAST")).toBe(false);
  });
});
