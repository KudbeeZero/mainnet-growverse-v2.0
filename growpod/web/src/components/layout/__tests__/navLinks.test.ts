import { describe, it, expect } from "vitest";
import {
  NAV_LINKS,
  PRIMARY_LINKS,
  SECONDARY_LINKS,
  isActiveLink,
} from "@/components/layout/navLinks";

describe("navLinks config", () => {
  it("every link has an href, label, and icon", () => {
    for (const l of NAV_LINKS) {
      expect(l.href).toMatch(/^\//);
      expect(l.label.length).toBeGreaterThan(0);
      expect(l.icon.length).toBeGreaterThan(0);
    }
  });

  it("hrefs are unique", () => {
    const hrefs = NAV_LINKS.map((l) => l.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("primary + secondary partition the full list", () => {
    expect(PRIMARY_LINKS.length + SECONDARY_LINKS.length).toBe(NAV_LINKS.length);
  });

  it("keeps the mobile bottom bar to ≤4 primary tabs (+ a More slot = ≤5)", () => {
    // The bottom tab bar renders PRIMARY_LINKS plus a fixed "More" button.
    // Native-app convention caps the bar at 5 destinations.
    expect(PRIMARY_LINKS.length).toBeGreaterThan(0);
    expect(PRIMARY_LINKS.length).toBeLessThanOrEqual(4);
  });
});

describe("isActiveLink", () => {
  it("matches the exact route", () => {
    expect(isActiveLink("/lab", "/lab")).toBe(true);
  });

  it("matches sub-routes", () => {
    expect(isActiveLink("/lab/strains/abc", "/lab")).toBe(true);
    expect(isActiveLink("/dashboard/plants/1/chamber", "/dashboard")).toBe(true);
  });

  it("does not match unrelated routes or prefixes that aren't path segments", () => {
    expect(isActiveLink("/market", "/lab")).toBe(false);
    // "/laboratory" must not be treated as a sub-route of "/lab".
    expect(isActiveLink("/laboratory", "/lab")).toBe(false);
  });
});
