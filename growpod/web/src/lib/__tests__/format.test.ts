import { describe, it, expect, vi, afterEach } from "vitest";
import {
  grow,
  num,
  timeAgo,
  dateTime,
  hours,
  msUntil,
  countdown,
  clampPct,
  titleCase,
  RARITY_HEX,
  RARITY_STYLES,
  SEVERITY_STYLES,
  URGENCY_STYLES,
} from "@/lib/format";

const HEX6 = /^#[0-9a-fA-F]{6}$/;

afterEach(() => {
  vi.useRealTimers();
});

describe("grow", () => {
  it("returns em dash for null/undefined", () => {
    expect(grow(null)).toBe("—");
    expect(grow(undefined)).toBe("—");
  });

  it("formats zero", () => {
    expect(grow(0)).toBe("0 GC");
  });

  it("appends the GC suffix", () => {
    expect(grow(5)).toBe("5 GC");
    expect(grow(1234)).toMatch(/ GC$/);
  });

  it("clamps to at most 2 fraction digits", () => {
    // 1.005 -> at most 2 decimals; assert no more than 2 digits after a dot
    const out = grow(1.23456);
    expect(out).toMatch(/ GC$/);
    const numeric = out.replace(/[^0-9.]/g, "");
    const decimals = numeric.split(".")[1] ?? "";
    expect(decimals.length).toBeLessThanOrEqual(2);
  });

  it("handles negatives", () => {
    expect(grow(-5)).toMatch(/^-?5 GC$/);
    expect(grow(-5)).toContain("5");
    expect(grow(-5)).toContain("GC");
  });

  it("handles large values with grouping", () => {
    const out = grow(1000000);
    expect(out).toMatch(/ GC$/);
    // value should still contain the significant digits
    expect(out.replace(/[^0-9]/g, "")).toContain("1000000");
  });
});

describe("num", () => {
  it("returns em dash for null/undefined", () => {
    expect(num(null)).toBe("—");
    expect(num(undefined)).toBe("—");
  });

  it("defaults to 0 fraction digits", () => {
    expect(num(3.7)).toBe("4");
    expect(num(0)).toBe("0");
  });

  it("honors a digits argument", () => {
    expect(num(3.14159, 2)).toBe("3.14");
    expect(num(3.14159, 4)).toBe("3.1416");
  });

  it("handles negatives and large values", () => {
    expect(num(-12)).toBe("-12");
    expect(num(1000000).replace(/[^0-9]/g, "")).toContain("1000000");
  });
});

describe("timeAgo", () => {
  it("returns empty string for falsy input", () => {
    expect(timeAgo(null)).toBe("");
    expect(timeAgo(undefined)).toBe("");
    expect(timeAgo("")).toBe("");
  });

  it("returns empty string for unparseable dates", () => {
    expect(timeAgo("not-a-date")).toBe("");
  });

  it("formats seconds", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:30Z"));
    expect(timeAgo("2026-01-01T00:00:00Z")).toBe("30s ago");
  });

  it("formats minutes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:05:00Z"));
    expect(timeAgo("2026-01-01T00:00:00Z")).toBe("5m ago");
  });

  it("formats hours", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T03:00:00Z"));
    expect(timeAgo("2026-01-01T00:00:00Z")).toBe("3h ago");
  });

  it("formats days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-04T00:00:00Z"));
    expect(timeAgo("2026-01-01T00:00:00Z")).toBe("3d ago");
  });
});

describe("dateTime", () => {
  it("returns em dash for falsy input", () => {
    expect(dateTime(null)).toBe("—");
    expect(dateTime(undefined)).toBe("—");
    expect(dateTime("")).toBe("—");
  });

  it("returns em dash for unparseable dates", () => {
    expect(dateTime("nonsense")).toBe("—");
  });

  it("returns a non-empty locale string for a valid date", () => {
    const out = dateTime("2026-01-01T00:00:00Z");
    expect(out).not.toBe("—");
    expect(out.length).toBeGreaterThan(0);
  });
});

describe("hours", () => {
  it("returns em dash for null/undefined/NaN", () => {
    expect(hours(null)).toBe("—");
    expect(hours(undefined)).toBe("—");
    expect(hours(NaN)).toBe("—");
  });

  it("returns 0h for zero and negatives", () => {
    expect(hours(0)).toBe("0h");
    expect(hours(-3)).toBe("0h");
  });

  it("formats minutes only when under an hour", () => {
    expect(hours(0.5)).toBe("30m");
  });

  it("formats hours and minutes", () => {
    expect(hours(5)).toBe("5h 0m");
    expect(hours(2.5)).toBe("2h 30m");
  });

  it("formats days and hours", () => {
    expect(hours(24)).toBe("1d 0h");
    expect(hours(27)).toBe("1d 3h");
    expect(hours(51)).toBe("2d 3h");
  });
});

describe("msUntil", () => {
  it("returns 0 for falsy input", () => {
    expect(msUntil(null)).toBe(0);
    expect(msUntil(undefined)).toBe(0);
    expect(msUntil("")).toBe(0);
  });

  it("returns 0 for unparseable input", () => {
    expect(msUntil("nope")).toBe(0);
  });

  it("returns a positive value for a future time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    expect(msUntil("2026-01-01T00:00:10Z")).toBe(10_000);
  });

  it("returns a negative value for a past time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:10Z"));
    expect(msUntil("2026-01-01T00:00:00Z")).toBe(-10_000);
  });
});

describe("countdown", () => {
  it("returns 'closed' for zero and negatives", () => {
    expect(countdown(0)).toBe("closed");
    expect(countdown(-1000)).toBe("closed");
  });

  it("formats hh:mm:ss without a day prefix when under a day", () => {
    expect(countdown(1000)).toBe("00:00:01");
    expect(countdown((3600 + 12 * 60 + 33) * 1000)).toBe("01:12:33");
  });

  it("includes a day prefix when >= 1 day", () => {
    const ms = (86400 + 4 * 3600 + 12 * 60 + 33) * 1000;
    expect(countdown(ms)).toBe("1d 04:12:33");
  });

  it("zero-pads single digits", () => {
    expect(countdown(5000)).toBe("00:00:05");
  });
});

describe("clampPct", () => {
  it("passes through in-range values", () => {
    expect(clampPct(50)).toBe(50);
    expect(clampPct(0)).toBe(0);
    expect(clampPct(100)).toBe(100);
  });

  it("clamps below 0 to 0", () => {
    expect(clampPct(-20)).toBe(0);
  });

  it("clamps above 100 to 100", () => {
    expect(clampPct(150)).toBe(100);
  });

  it("propagates NaN (Math.max/min behavior)", () => {
    expect(Number.isNaN(clampPct(NaN))).toBe(true);
  });
});

describe("titleCase", () => {
  it("title-cases plain words", () => {
    expect(titleCase("hello world")).toBe("Hello World");
  });

  it("replaces underscores and hyphens with spaces and capitalizes", () => {
    expect(titleCase("root_rot")).toBe("Root Rot");
    expect(titleCase("nutrient-burn")).toBe("Nutrient Burn");
  });

  it("handles an empty string", () => {
    expect(titleCase("")).toBe("");
  });

  it("capitalizes a single word", () => {
    expect(titleCase("indica")).toBe("Indica");
  });
});

describe("RARITY_HEX", () => {
  it("has an entry for every rarity tier", () => {
    expect(Object.keys(RARITY_HEX).sort()).toEqual(
      ["common", "epic", "legendary", "rare", "uncommon"].sort(),
    );
  });

  it("contains only valid 6-digit hex colors", () => {
    for (const v of Object.values(RARITY_HEX)) {
      expect(v).toMatch(HEX6);
    }
  });
});

describe("RARITY_STYLES", () => {
  it("has an entry for every rarity tier with non-empty class strings", () => {
    expect(Object.keys(RARITY_STYLES).sort()).toEqual(
      ["common", "epic", "legendary", "rare", "uncommon"].sort(),
    );
    for (const v of Object.values(RARITY_STYLES)) {
      expect(v.length).toBeGreaterThan(0);
    }
  });
});

describe("SEVERITY_STYLES", () => {
  it("covers sim severities and advisor severities", () => {
    for (const key of [
      "healthy",
      "mild",
      "minor",
      "moderate",
      "serious",
      "severe",
      "critical",
    ]) {
      expect(SEVERITY_STYLES[key]).toBeDefined();
      expect(SEVERITY_STYLES[key].length).toBeGreaterThan(0);
    }
  });

  it("returns undefined for unknown keys", () => {
    expect(SEVERITY_STYLES["unknown"]).toBeUndefined();
  });
});

describe("URGENCY_STYLES", () => {
  it("covers now/soon/optional with non-empty class strings", () => {
    for (const key of ["now", "soon", "optional"]) {
      expect(URGENCY_STYLES[key]).toBeDefined();
      expect(URGENCY_STYLES[key].length).toBeGreaterThan(0);
    }
  });

  it("returns undefined for unknown keys", () => {
    expect(URGENCY_STYLES["later"]).toBeUndefined();
  });
});
