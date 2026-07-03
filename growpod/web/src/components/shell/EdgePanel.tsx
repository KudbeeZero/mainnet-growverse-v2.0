"use client";

// One glassmorphic edge overlay: a slim always-visible "tab" handle that
// expands into the full panel. Never pushes/resizes the hero (chamber) view —
// it slides on top, matching the mockups' "always in focus" chamber.

import { useEffect, useState, type ReactNode } from "react";

export type PanelSide = "left" | "right";

export const WIDTH_PRESETS = [280, 340, 400] as const;

// Matches the panel's `duration-300` slide transition — content stays mounted
// through the close animation, then unmounts so a "closed" panel is genuinely
// gone from the DOM (not just translated off-screen), matching the mockups'
// "never permanently displaces" rule and keeping closed content out of the
// tab order / accessibility tree / test queries.
const CLOSE_UNMOUNT_MS = 320;

export function EdgePanel({
  side,
  label,
  icon,
  accent,
  open,
  widthIndex,
  onOpen,
  onClose,
  onCycleWidth,
  onTabPointerEnter,
  children,
}: {
  side: PanelSide;
  label: string;
  icon: string;
  /** Tailwind-safe rgb triplet, e.g. "56,189,248" — reused from the care-tile accent language. */
  accent: string;
  open: boolean;
  /** Index into `WIDTH_PRESETS` — the panel derives its own pixel width from
   *  this so callers don't have to keep a redundant `widthPx` in sync. */
  widthIndex: number;
  onOpen: () => void;
  onClose: () => void;
  onCycleWidth: () => void;
  /** Desktop hover-to-expand only — no matching leave handler (see GameShell.tsx). */
  onTabPointerEnter?: () => void;
  children: ReactNode;
}) {
  const widthPx = WIDTH_PRESETS[widthIndex];
  const edgeCls = side === "left" ? "left-0" : "right-0";
  const panelEdgeCls = side === "left" ? "left-0 border-r" : "right-0 border-l";
  const tabRounded = side === "left" ? "rounded-r-xl" : "rounded-l-xl";

  // Mount content the instant it opens; keep it mounted through the close
  // transition, then unmount — so a compacted panel has no content in the DOM.
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const t = setTimeout(() => setMounted(false), CLOSE_UNMOUNT_MS);
    return () => clearTimeout(t);
  }, [open]);

  return (
    <>
      {/* Slim compact tab — ALWAYS visible (mockup: "subtle handles on each
          side indicate more tools are just a swipe away"), even when the
          panel is fully closed. */}
      <button
        type="button"
        data-testid={`edge-tab-${side}`}
        aria-expanded={open}
        aria-label={`${open ? "Collapse" : "Expand"} ${label}`}
        onClick={() => (open ? onClose() : onOpen())}
        onMouseEnter={onTabPointerEnter}
        className={`absolute top-1/2 z-30 flex h-16 w-6 -translate-y-1/2 flex-col items-center justify-center gap-1 border border-white/15 bg-[#08141e]/80 backdrop-blur-md transition-opacity ${edgeCls} ${tabRounded} ${
          open ? "pointer-events-none opacity-0" : "opacity-90 hover:opacity-100"
        }`}
        style={{ boxShadow: `0 0 10px rgba(${accent},0.25)` }}
      >
        <span className="text-sm leading-none" aria-hidden>
          {icon}
        </span>
        <span aria-hidden className="text-[9px]" style={{ color: `rgb(${accent})` }}>
          {side === "left" ? "›" : "‹"}
        </span>
      </button>

      {/* Expanded overlay panel. */}
      <div
        data-testid={`edge-panel-${side}`}
        className={`absolute inset-y-0 z-40 flex flex-col border-white/10 bg-[#050d15]/92 shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-out ${panelEdgeCls} ${
          open
            ? "translate-x-0"
            : side === "left"
              ? "-translate-x-[calc(100%+8px)]"
              : "translate-x-[calc(100%+8px)]"
        }`}
        style={{ width: widthPx, boxShadow: `0 0 40px rgba(${accent},0.12)` }}
        aria-hidden={!open}
      >
        <div className="flex flex-none items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
          <h2 className="flex items-center gap-1.5 text-[11px] font-extrabold tracking-[0.16em]" style={{ color: `rgb(${accent})` }}>
            <span aria-hidden>{icon}</span> {label.toUpperCase()}
          </h2>
          <div className="flex items-center gap-1">
            {/* Desktop resize preset cycle (S/M/L) — a fixed-preset stand-in for
                free drag-resize; see GameShell.tsx for the tradeoff note. */}
            <button
              type="button"
              onClick={onCycleWidth}
              title="Resize panel"
              aria-label="Cycle panel width"
              className="hidden rounded-md border border-white/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-white/60 hover:border-white/30 hover:text-white sm:inline-block"
            >
              {["S", "M", "L"][widthIndex]}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={`Close ${label}`}
              className="rounded-md border border-white/15 px-2 py-0.5 text-[11px] font-bold text-white/70 hover:border-white/30 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2.5">{mounted && children}</div>
      </div>
    </>
  );
}
