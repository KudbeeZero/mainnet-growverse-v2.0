// Photoreal whole-plant-in-the-pod renders, BY GROWTH STAGE.
//
// The pod's "whole plant" view prefers a licensed photoreal still of the branded
// Grow-Pod at the plant's current growth stage; when a stage has no still it falls
// back to the procedural 2D `GrowChamber`. This is the per-stage sibling of the
// per-strain bud-hero pipeline in `budPhotos.ts`.
//
// LICENSING: these are owner-generated renders (xAI Creative Studio, Certificate of
// Authorization GP-VG-2026-001 — see growpod/docs/licenses/). Only ship stills we
// own or are licensed for.

import type { GrowthStage } from "@/lib/types";

/** growth stage → the public path of its photoreal pod still. Stages absent here
 * fall back to the 2D GrowChamber. */
const POD_STAGE_PHOTOS: Partial<Record<GrowthStage, string>> = {
  seed: "/pod/seed.jpg",
  germination: "/pod/germination.jpg",
  seedling: "/pod/seedling.jpg",
  vegetative: "/pod/vegetative.jpg",
  flowering: "/pod/flowering.jpg",
  late_flower: "/pod/late_flower.jpg",
  harvest: "/pod/harvest.jpg",
};

/** Pure resolver (exported for tests): the still for a stage, or null. */
export function resolvePodPhoto(
  manifest: Partial<Record<GrowthStage, string>>,
  stage: GrowthStage | string | null | undefined,
): string | null {
  if (!stage) return null;
  return manifest[stage as GrowthStage] ?? null;
}

/** The photoreal pod still for a growth stage, or null (caller renders the 2D pod). */
export function podPhotoForStage(stage: GrowthStage | string | null | undefined): string | null {
  return resolvePodPhoto(POD_STAGE_PHOTOS, stage);
}

/** True once at least one stage has a still. */
export function hasAnyPodPhoto(): boolean {
  return Object.keys(POD_STAGE_PHOTOS).length > 0;
}
