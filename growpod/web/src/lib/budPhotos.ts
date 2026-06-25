// Photoreal bud hero assets (opt-in, per strain).
//
// The showcase bud prefers a real PHOTO/RENDER when we have one we're licensed to
// ship; otherwise the procedural 3D bud (StrainBud3D / BudGL) renders as an automatic
// fallback. Drop image files in /public/buds and register them in BUD_PHOTOS below —
// see /public/buds/README.md for the file convention and recommended sizes.
//
// LICENSING (read before adding anything): only register assets we OWN or have a
// COMMERCIAL LICENSE for (our own photography/renders, a licensed stock pack, or
// AI renders from a service that grants commercial rights). NEVER register third-party
// product photos — seed-bank catalog shots, Google-image results, or any web image —
// GROWv2 is a monetized app and shipping those is copyright infringement.

export type BudStage = "flower" | "harvest";

/**
 * strain key (slug or name, lower-cased) → the photo stages we have for it.
 * Empty by default: with nothing registered every strain falls back to the 3D bud.
 * Add entries as licensed assets land, e.g.
 *   "blue-dream": { harvest: "/buds/blue-dream-harvest.webp" },
 */
const BUD_PHOTOS: Record<string, Partial<Record<BudStage, string>>> = {};

/** Pure resolver (exported for tests): pick the requested stage, then fall back to any
 * stage we do have, then null. Key match is case/space-insensitive. */
export function resolveBudPhoto(
  manifest: Record<string, Partial<Record<BudStage, string>>>,
  key: string | null | undefined,
  stage: BudStage = "harvest",
): string | null {
  if (!key) return null;
  const entry = manifest[key.trim().toLowerCase()];
  if (!entry) return null;
  return entry[stage] ?? entry.harvest ?? entry.flower ?? null;
}

/** Resolve the photoreal hero image for a strain, or null when we have no licensed
 * photo (the caller then renders the 3D bud). */
export function budPhotoFor(key: string | null | undefined, stage: BudStage = "harvest"): string | null {
  return resolveBudPhoto(BUD_PHOTOS, key, stage);
}

/** True once at least one strain has a registered photo. */
export function hasAnyBudPhoto(): boolean {
  return Object.keys(BUD_PHOTOS).length > 0;
}
