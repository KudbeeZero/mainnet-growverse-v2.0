"use client";

// DEV-ONLY isolated preview for the Trichome Rush overlay — purely additive,
// never reachable in prod (the route's page.tsx 404s outside
// `NODE_ENV === "development"`). Mounts the overlay directly (always `open`)
// over a dark placeholder "chamber" so it can be reviewed without a live
// plant/session.

import { useState } from "react";
import { TrichomeRush } from "@/components/arcade/TrichomeRush";

export function TrichomeRushPanel() {
  const [open, setOpen] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  return (
    <div className="relative h-screen w-full bg-[#050b12] text-[#cfeeff]">
      <div className="flex items-center gap-3 border-b border-[#11212e] px-4 py-2 font-mono text-xs">
        <span className="text-cyan-200/70">Trichome Rush — dev preview</span>
        <label className="ml-auto flex items-center gap-1.5">
          <input type="checkbox" checked={reducedMotion} onChange={(e) => setReducedMotion(e.target.checked)} />
          prefers-reduced-motion
        </label>
        <button
          onClick={() => setOpen((o) => !o)}
          className="rounded-md border border-cyan-400/40 px-2 py-1 text-cyan-100"
        >
          {open ? "Close overlay" : "Open overlay"}
        </button>
      </div>
      <TrichomeRush
        open={open}
        onClose={() => setOpen(false)}
        reducedMotion={reducedMotion}
        plantId="dev-plant"
        strainName="dev-strain"
      />
    </div>
  );
}
