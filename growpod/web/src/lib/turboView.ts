// Pure resolver for the SPEED control's displayed state.
//
// The turbo faucet is server-authoritative; the UI should always render a sane
// SPEED readout even before the first /turbo response (or if it fails), instead
// of a blank/again-misleading control. Keeping this pure makes it unit-testable
// and keeps the default multiplier in one place.

import type { TurboState } from "@/lib/api";

/** Fallback multiplier shown before the server's truth arrives. Mirrors the
 *  backend's `simulation.turbo_multiplier` headline (~watchable speed). */
export const DEFAULT_TURBO_MULTIPLIER = 250;

export interface TurboView {
  enabled: boolean;
  multiplier: number;
}

/** Display state from the server truth, with safe fallbacks. */
export function turboView(state: TurboState | undefined | null): TurboView {
  return {
    enabled: state?.enabled ?? false,
    multiplier: state?.multiplier ?? DEFAULT_TURBO_MULTIPLIER,
  };
}
