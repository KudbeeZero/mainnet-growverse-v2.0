import { describe, it, expect } from "vitest";
import {
  canFinishCure,
  canMint,
  canSell,
  cureDeadlineIso,
  meetsMintRarity,
  rarityIndex,
} from "@/components/harvest/harvestGatesData";

describe("rarityIndex / meetsMintRarity", () => {
  it("orders rarities low to high", () => {
    expect(rarityIndex("common")).toBe(0);
    expect(rarityIndex("legendary")).toBe(4);
    expect(rarityIndex("rare")).toBeGreaterThan(rarityIndex("uncommon"));
  });

  it("gates on the mint-min-rarity floor (default: rare)", () => {
    expect(meetsMintRarity("common")).toBe(false);
    expect(meetsMintRarity("uncommon")).toBe(false);
    expect(meetsMintRarity("rare")).toBe(true);
    expect(meetsMintRarity("epic")).toBe(true);
    expect(meetsMintRarity("legendary")).toBe(true);
  });

  it("accepts a custom floor", () => {
    expect(meetsMintRarity("uncommon", "uncommon")).toBe(true);
    expect(meetsMintRarity("common", "uncommon")).toBe(false);
  });
});

describe("canMint", () => {
  it("blocks commons even when not curing (C2 — the starter path always errored)", () => {
    expect(canMint("none", "common")).toBe(false);
  });

  it("blocks a rare that's mid-cure", () => {
    expect(canMint("curing", "rare")).toBe(false);
  });

  it("allows a rare-or-better harvest once cured/uncured (not curing)", () => {
    expect(canMint("none", "rare")).toBe(true);
    expect(canMint("cured", "epic")).toBe(true);
  });
});

describe("canSell", () => {
  it("blocks selling while curing (C4 — guaranteed backend error otherwise)", () => {
    expect(canSell("curing")).toBe(false);
  });

  it("allows selling when not curing", () => {
    expect(canSell("none")).toBe(true);
    expect(canSell("cured")).toBe(true);
    expect(canSell(undefined)).toBe(true);
  });
});

describe("cureDeadlineIso", () => {
  it("computes startedAt + targetHours", () => {
    const iso = cureDeadlineIso("2026-01-01T00:00:00.000Z", 48);
    expect(iso).toBe("2026-01-03T00:00:00.000Z");
  });

  it("returns null when timing data is missing or invalid", () => {
    expect(cureDeadlineIso(null, 48)).toBeNull();
    expect(cureDeadlineIso("2026-01-01T00:00:00.000Z", null)).toBeNull();
    expect(cureDeadlineIso("not-a-date", 48)).toBeNull();
    expect(cureDeadlineIso("2026-01-01T00:00:00.000Z", 0)).toBeNull();
  });
});

describe("canFinishCure", () => {
  it("blocks before the deadline (C3 — was clickable immediately, error-toasted)", () => {
    const deadline = "2026-01-03T00:00:00.000Z";
    const before = new Date("2026-01-02T00:00:00.000Z").getTime();
    expect(canFinishCure(before, deadline)).toBe(false);
  });

  it("allows at/after the deadline", () => {
    const deadline = "2026-01-03T00:00:00.000Z";
    const at = new Date(deadline).getTime();
    const after = new Date("2026-01-04T00:00:00.000Z").getTime();
    expect(canFinishCure(at, deadline)).toBe(true);
    expect(canFinishCure(after, deadline)).toBe(true);
  });

  it("never blocks when there's no deadline to check against", () => {
    expect(canFinishCure(Date.now(), null)).toBe(true);
  });
});
