import { describe, expect, it } from "vitest";
import { timeControlsGate } from "@/lib/timeControls";
import type { PlantState } from "@/lib/types";

const alive = { is_alive: true, harvested: false } as PlantState;
const dead = { is_alive: false, harvested: false } as PlantState;
const reaped = { is_alive: true, harvested: true } as PlantState;

describe("timeControlsGate", () => {
  it("disables with a loading reason while the plant is loading or absent", () => {
    expect(timeControlsGate(undefined, true)).toEqual({
      disabled: true,
      reason: "Loading this plant…",
    });
    expect(timeControlsGate(undefined, false).disabled).toBe(true);
  });

  it("enables (no reason) for a living, unharvested plant", () => {
    expect(timeControlsGate(alive, false)).toEqual({ disabled: false, reason: null });
  });

  it("explains a harvested or dead plant", () => {
    expect(timeControlsGate(reaped, false).reason).toMatch(/harvest/i);
    expect(timeControlsGate(dead, false).reason).toMatch(/died/i);
  });
});
