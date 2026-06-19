import { describe, it, expect } from "vitest";
import { shouldResync, RESYNC_THRESHOLD_MS } from "@/hooks/useCountdown";

describe("shouldResync (countdown anti-jitter)", () => {
  it("ignores sub-threshold poll noise (no re-anchor → no jitter)", () => {
    // The ~7s state poll re-issues an ETA that drifts by a second or two.
    expect(shouldResync(3_600_000, 3_600_000)).toBe(false);
    expect(shouldResync(3_600_000, 3_601_500)).toBe(false); // +1.5s drift
    expect(shouldResync(3_600_000, 3_598_000)).toBe(false); // -2s drift
  });

  it("re-anchors on a genuine reschedule (drift beyond the threshold)", () => {
    expect(shouldResync(3_600_000, 3_600_000 + RESYNC_THRESHOLD_MS + 1)).toBe(true);
    expect(shouldResync(3_600_000, 3_540_000)).toBe(true); // -60s real change
    expect(shouldResync(3_600_000, 0)).toBe(true); // target cleared/harvested
  });
});
