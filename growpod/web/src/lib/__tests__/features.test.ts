import { describe, it, expect, afterEach } from "vitest";
import { computeFeatures, enabledUnlessDisabled, isDevBypassEnabled } from "@/lib/features";

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

describe("enabledUnlessDisabled (live FEATURES resolver)", () => {
  it("defaults ON when unset (preserves live production behavior)", () => {
    expect(enabledUnlessDisabled(undefined)).toBe(true);
    expect(enabledUnlessDisabled("")).toBe(true);
  });

  it('turns OFF only on the exact string "false"', () => {
    expect(enabledUnlessDisabled("false")).toBe(false);
    expect(enabledUnlessDisabled("FALSE")).toBe(true); // not exact → stays ON
    expect(enabledUnlessDisabled("0")).toBe(true);
    expect(enabledUnlessDisabled("true")).toBe(true);
  });
});

describe("isDevBypassEnabled (Enter-as-tester gate)", () => {
  const ENV = process.env.NEXT_PUBLIC_ENABLE_DEV_BYPASS;
  const BUILD = process.env.NEXT_PUBLIC_BUILD_ENV;
  afterEach(() => {
    process.env.NEXT_PUBLIC_ENABLE_DEV_BYPASS = ENV;
    process.env.NEXT_PUBLIC_BUILD_ENV = BUILD;
  });

  it("is ON for non-production builds (Vercel preview / local dev)", () => {
    delete process.env.NEXT_PUBLIC_ENABLE_DEV_BYPASS;
    for (const env of ["preview", "development", "local"]) {
      process.env.NEXT_PUBLIC_BUILD_ENV = env;
      expect(isDevBypassEnabled()).toBe(true);
    }
  });

  it("is OFF on production (never bypass auth in prod)", () => {
    delete process.env.NEXT_PUBLIC_ENABLE_DEV_BYPASS;
    process.env.NEXT_PUBLIC_BUILD_ENV = "production";
    expect(isDevBypassEnabled()).toBe(false);
  });

  it('the explicit "true" override forces it ON regardless of build env', () => {
    process.env.NEXT_PUBLIC_ENABLE_DEV_BYPASS = "true";
    process.env.NEXT_PUBLIC_BUILD_ENV = "production";
    expect(isDevBypassEnabled()).toBe(true);
  });
});
