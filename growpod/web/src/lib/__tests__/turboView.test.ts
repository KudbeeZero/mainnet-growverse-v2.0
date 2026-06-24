import { describe, expect, it } from "vitest";
import { DEFAULT_TURBO_MULTIPLIER, turboView } from "@/lib/turboView";
import type { TurboState } from "@/lib/api";

describe("turboView", () => {
  it("falls back to a sane default before server truth arrives", () => {
    expect(turboView(undefined)).toEqual({
      enabled: false,
      multiplier: DEFAULT_TURBO_MULTIPLIER,
    });
    expect(turboView(null)).toEqual({
      enabled: false,
      multiplier: DEFAULT_TURBO_MULTIPLIER,
    });
  });

  it("reflects the server state when present", () => {
    const state = {
      enabled: true,
      multiplier: 100,
      offset_hours: 0,
      effective_now: "",
      wall_now: "",
    } as TurboState;
    expect(turboView(state)).toEqual({ enabled: true, multiplier: 100 });
  });
});
