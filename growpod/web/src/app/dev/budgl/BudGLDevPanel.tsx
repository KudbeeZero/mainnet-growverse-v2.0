"use client";

// DEV-ONLY close-up bud studio. Renders the shipped StrainBud3D (BudGL pipeline)
// full-viewport on a neutral studio background so the live close-up bud can be
// reviewed in isolation against the reference photos. Pure local geometry.

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { budDnaFor } from "@/lib/chamber/budDna";
import { budColorForStrain } from "@/lib/chamber/strainVisuals";

const StrainBud3D = dynamic(() => import("@/components/viz/StrainBud3D").then((m) => m.StrainBud3D), {
  ssr: false,
  loading: () => null,
});

const STRAIN = "blue-dream";

export function BudGLDevPanel() {
  const dna = useMemo(() => budDnaFor(STRAIN, budColorForStrain(STRAIN, 110, 42)), []);
  return (
    <div style={{ position: "fixed", inset: 0, background: "#d9dbdd" }}>
      <StrainBud3D dna={dna} seed={42} />
      <div
        data-hud
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          padding: "10px 12px",
          borderRadius: 10,
          background: "rgba(255,255,255,0.72)",
          font: "13px/1.4 system-ui, sans-serif",
          color: "#222",
        }}
      >
        <strong>Blue Dream — close-up bud (BudGL)</strong>
      </div>
    </div>
  );
}
