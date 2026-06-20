// Shared helpers for the environment sliders so the Grow Chamber and the Command
// Center env rail dial in identically. Pure + unit-testable (no DOM). The backend
// already accepts floats, so finer steps + ±nudge just give precise control.

/** Decimal places implied by a step (e.g. 0.05 → 2), so we can clean float dust. */
function decimalsOf(step: number): number {
  const s = String(step);
  return s.includes(".") ? s.split(".")[1].length : 0;
}

/**
 * Snap `value` to the step grid and clamp to [min, max], returning a number with
 * the step's decimal precision (so 6.1 + 0.05 reads 6.15, never 6.150000001).
 */
export function quantize(value: number, step: number, min: number, max: number): number {
  const snapped = Math.round(value / step) * step;
  const clamped = Math.min(max, Math.max(min, snapped));
  return Number(clamped.toFixed(decimalsOf(step)));
}

/** Nudge by one step in `dir` (±1), quantized to the grid and clamped to range. */
export function nudge(value: number, dir: 1 | -1, step: number, min: number, max: number): number {
  return quantize(value + dir * step, step, min, max);
}
