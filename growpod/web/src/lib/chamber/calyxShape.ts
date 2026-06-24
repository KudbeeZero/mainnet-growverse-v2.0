// Calyx shape selection for the macro bud — pure so the distribution is
// unit-testable. Ovals are what make a bud read as a "bunch of grapes," so the
// mix is biased toward teardrops (round belly, pointed tip) with ovals kept to a
// thin band; pointed and foxtail calyxes climb near the light-stressed top.

export const CALYX_TEARDROP = 0;
export const CALYX_OVAL = 1;
export const CALYX_POINTED = 2;
export const CALYX_FOXTAIL = 3;

export type CalyxShape = 0 | 1 | 2 | 3;

/**
 * Pick a calyx shape from a 0..1 roll. Teardrops take the bottom 52% (up from
 * the old 40%), ovals fill the gap up to `ovalCut`, then pointed up to `foxCut`,
 * then foxtail. `ovalCut`/`foxCut` come from the strain's foxtail/top-stretch
 * traits so light-stressed tops skew pointed.
 */
export function calyxShapeFor(sr: number, ovalCut: number, foxCut: number): CalyxShape {
  if (sr < 0.52) return CALYX_TEARDROP;
  if (sr < ovalCut) return CALYX_OVAL;
  if (sr < foxCut) return CALYX_POINTED;
  return CALYX_FOXTAIL;
}
