"use client";

// GR🌿VERS — the brand wordmark. The "O" is a living particle leaf: the same
// Constellation engine in leaf mode, frameless and view-locked so it sits
// inline like a letter. Move a cursor (or finger) over it and the particles
// scatter, then spring home. Scales with its container (mobile-first).

import { useEffect, useRef, useState } from "react";
import { Constellation } from "./Constellation";

interface Props {
  className?: string;
  /** Accent color forwarded to the leaf. */
  accent?: string;
}

export function GroversWordmark({ className = "", accent = "#76c024" }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  // The O's pixel size, derived from container width. Quantized to 8px steps
  // so resize drips don't re-seed the particle cloud on every frame.
  const [oSize, setOSize] = useState(144);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth || 480;
      // Row budget: GR+VERS (6 caps ≈ 0.75em each) + v2 + the O must fit the
      // container, so the whole mark ≈ 3.9×oSize — keep oSize ≤ 0.24×width.
      // (The observed width never depends on oSize, so this cannot oscillate.)
      const next = Math.round(Math.max(64, Math.min(208, w * 0.24)) / 8) * 8;
      setOSize((prev) => (prev === next ? prev : next));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fontSize = Math.round(oSize * 0.58);

  return (
    <div ref={ref} role="img" aria-label="GROVERS version 2" className={className}>
      <div className="flex items-center justify-center" aria-hidden="true">
        <span
          className="select-none font-black leading-none tracking-tight text-gray-50"
          style={{ fontSize }}
        >
          GR
        </span>
        <div className="relative" style={{ width: oSize, height: oSize }}>
          <Constellation
            mode="leaf"
            frameless
            lockView
            height={oSize}
            leafCount={260}
            showCount={false}
            accent={accent}
          />
        </div>
        <span
          className="select-none font-black leading-none tracking-tight text-gray-50"
          style={{ fontSize }}
        >
          VERS
        </span>
        <span
          className="text-glow-grow select-none self-start font-bold text-grow-300"
          style={{ fontSize: Math.round(fontSize * 0.34) }}
        >
          v2
        </span>
      </div>
    </div>
  );
}
