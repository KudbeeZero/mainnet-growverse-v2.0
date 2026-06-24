// Early-stage visual size boost.
//
// Seed/germination/seedling organs are sized off the medium radius, which makes
// a fresh sprout render as a tiny dot-with-lines in a big chamber. These per-
// stage multipliers scale the visible organs up so the plant is recognizable
// from day one, easing back to 1× once it's a real vegetative plant. Pure +
// unit-tested; the chamber draw multiplies its size bases by this.

export function earlyStageBoost(stage: string): number {
  switch (stage) {
    case "seed":
      return 1.6;
    case "germination":
      return 1.45;
    case "seedling":
      return 1.25;
    default:
      return 1;
  }
}
