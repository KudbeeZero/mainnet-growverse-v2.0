"use client";

// The pod's "whole plant" view. Prefers a licensed photoreal still of the branded
// Grow-Pod at the plant's current growth stage (see lib/podStagePhotos.ts); when a
// stage has no still it renders the supplied 2D `GrowChamber` fallback — so the pod
// always shows something and unmapped stages degrade gracefully. Photo-first, no
// layout change (both fill the positioned parent).

import type { ReactNode } from "react";
import type { GrowthStage } from "@/lib/types";
import { podPhotoForStage } from "@/lib/podStagePhotos";

export function PodPlantPhoto({
  stage,
  alt,
  fallback,
}: {
  stage: GrowthStage | string;
  alt: string;
  /** The 2D GrowChamber to render when this stage has no photoreal still. */
  fallback: ReactNode;
}) {
  const src = podPhotoForStage(stage);
  if (!src) return <>{fallback}</>;
  return (
    // Local /public asset; plain <img> keeps the fallback path dependency-free.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className="absolute inset-0 h-full w-full object-cover" />
  );
}
