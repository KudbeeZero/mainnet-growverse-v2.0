"use client";

// The strain "showcase" bud. Prefers a licensed photoreal PHOTO/RENDER when one is
// registered for the strain (see lib/budPhotos.ts) and otherwise renders the supplied
// 3D bud (StrainBud3D / BudGL) as an automatic fallback — so the catalog/pod never
// shows an empty slot, and upgrading a strain to photoreal is just dropping a file +
// one manifest line. No layout change either way: both fill the positioned parent.

import type { ReactNode } from "react";
import { budPhotoFor, type BudStage } from "@/lib/budPhotos";

export function StrainBudHero({
  strainKey,
  stage = "harvest",
  alt,
  fallback,
}: {
  /** Strain slug or name — matched case-insensitively against the photo manifest. */
  strainKey: string;
  /** Maturity stage to prefer (falls back to whatever stage we have). */
  stage?: BudStage;
  alt: string;
  /** The 3D bud to render when we have no licensed photo for this strain. */
  fallback: ReactNode;
}) {
  const src = budPhotoFor(strainKey, stage);
  if (!src) return <>{fallback}</>;
  return (
    // Local /public asset; plain <img> keeps the fallback path dependency-free.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className="absolute inset-0 h-full w-full object-cover" />
  );
}
