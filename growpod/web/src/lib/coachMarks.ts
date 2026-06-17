/**
 * FTUE coach-marks — the data + pure selection logic behind the lightweight
 * contextual tips shown on the real dashboard *after* the canonical `/ftue`
 * takeover (PR #35/#39). These do NOT re-run the tutorial; they point a
 * first-session player at real UI so the next move is obvious, then get out of
 * the way (non-nagging, dismissed-once-per-player).
 *
 * Pure + framework-free so the gating logic is unit-testable. DOM presence is
 * injected (`hasTarget`) — a mark only shows when its anchor is actually on the
 * page, so the sequence adapts to whatever the player has (0 pods vs. a plant).
 */

export interface CoachMarkDef {
  id: string;
  /** Matches an element tagged `data-coach="<target>"`. */
  target: string;
  title: string;
  body: string;
}

/** Sentinel stored when the player dismisses the whole sequence ("Skip tips"). */
export const ALL_DISMISSED = "__all__";

/**
 * Dashboard coach-marks, in priority order. A fresh FTUE graduate already has a
 * starter pod + seed (PR #34 grant), so "tend your plant" leads; a player with
 * zero pods falls through to "add a pod" since the first target is absent.
 */
export const DASHBOARD_COACH_MARKS: CoachMarkDef[] = [
  {
    id: "your-grows",
    target: "your-grows",
    title: "Tend your plant",
    body: "Tap a plant to open it — water, feed, and harvest all live here.",
  },
  {
    id: "new-pod",
    target: "new-pod",
    title: "Add a grow pod",
    body: "Pods are homes for your plants. Spin one up whenever you want to grow more.",
  },
  {
    id: "buy-seeds",
    target: "buy-seeds",
    title: "Find new genetics",
    body: "Browse the Lab for seeds and strains when you're ready to expand.",
  },
];

/**
 * The next mark to show: the first def that isn't dismissed and whose target is
 * currently on the page. Returns `null` when the sequence is finished, skipped,
 * or nothing is anchorable yet.
 */
export function nextCoachMark(
  defs: CoachMarkDef[],
  dismissed: readonly string[],
  hasTarget: (target: string) => boolean,
): CoachMarkDef | null {
  if (dismissed.includes(ALL_DISMISSED)) return null;
  for (const d of defs) {
    if (dismissed.includes(d.id)) continue;
    if (!hasTarget(d.target)) continue;
    return d;
  }
  return null;
}

/** How many marks remain showable (for the "1 of N" step indicator). */
export function remainingCount(
  defs: CoachMarkDef[],
  dismissed: readonly string[],
  hasTarget: (target: string) => boolean,
): number {
  if (dismissed.includes(ALL_DISMISSED)) return 0;
  return defs.filter((d) => !dismissed.includes(d.id) && hasTarget(d.target)).length;
}
