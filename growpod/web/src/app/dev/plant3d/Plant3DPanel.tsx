"use client";

// DEV-ONLY whole-plant 3D studio. Full-viewport neutral light-gray studio with
// the plant centred, plus a small control strip: LOD toggle (close/mid/far),
// seed input, and a close-up toggle. Reads nothing from the server — pure local
// geometry preview of the Blue Dream pilot asset.

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { budDnaFor } from "@/lib/chamber/budDna";
import { budColorForStrain, silhouetteFor } from "@/lib/chamber/strainVisuals";
import { buildPlantAssembly, type LODLevel } from "@/lib/plant3d/assembly";

const PlantGL = dynamic(() => import("@/components/viz/PlantGL").then((m) => m.PlantGL), {
  ssr: false,
  loading: () => null,
});

const STRAIN = "blue-dream";

export function Plant3DPanel() {
  const [lod, setLod] = useState<LODLevel>("close");
  const [seed, setSeed] = useState(42);
  const [tight, setTight] = useState(false);

  const dna = useMemo(() => budDnaFor(STRAIN, budColorForStrain(STRAIN, 110, seed)), [seed]);
  const sil = useMemo(() => silhouetteFor(STRAIN, 0.4), []);

  // Live triangle/instance readout so the perf budget stays visible while tuning.
  const counts = useMemo(
    () => buildPlantAssembly(dna, sil, seed, { lod }).counts,
    [dna, sil, seed, lod],
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "#d9dbdd" }}>
      <PlantGL dna={dna} sil={sil} seed={seed} lod={lod} cameraTight={tight} />

      <div
        data-hud
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          padding: "12px 14px",
          borderRadius: 10,
          background: "rgba(255,255,255,0.72)",
          backdropFilter: "blur(6px)",
          boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
          font: "13px/1.4 system-ui, sans-serif",
          color: "#222",
          minWidth: 210,
        }}
      >
        <strong style={{ fontSize: 14 }}>Blue Dream — whole plant</strong>

        <div style={{ display: "flex", gap: 6 }}>
          {(["close", "mid", "far"] as LODLevel[]).map((l) => (
            <button
              key={l}
              onClick={() => setLod(l)}
              style={{
                flex: 1,
                padding: "6px 4px",
                borderRadius: 6,
                border: "1px solid #bbb",
                cursor: "pointer",
                background: lod === l ? "#2f7d4f" : "#fff",
                color: lod === l ? "#fff" : "#333",
                fontWeight: lod === l ? 600 : 400,
                textTransform: "capitalize",
              }}
            >
              {l}
            </button>
          ))}
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 42 }}>Seed</span>
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
            style={{ flex: 1, padding: "4px 6px", borderRadius: 6, border: "1px solid #bbb" }}
          />
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={tight} onChange={(e) => setTight(e.target.checked)} />
          <span>Close-up on main cola</span>
        </label>

        <div style={{ fontSize: 11, color: "#555", lineHeight: 1.6 }}>
          colas {counts.colas} · calyx {counts.calyxes} · frost {counts.frost}
          <br />
          pistils {counts.pistils} · sugar {counts.sugar} · leaves {counts.leaves}
        </div>
      </div>
    </div>
  );
}
