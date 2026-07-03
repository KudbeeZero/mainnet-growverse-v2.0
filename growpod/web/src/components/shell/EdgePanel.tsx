"use client";

// One glassmorphic edge overlay: a slim always-visible "tab" handle that
// expands into the full panel. Never pushes/resizes the hero (chamber) view —
// it slides on top, matching the mockups' "always in focus" chamber.

import { useEffect, useRef, useState, type ReactNode } from "react";

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

  const tabRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  // Set during render (before this update commits `inert` to the DOM below) so
  // we capture "was focus inside the panel" from the LAST committed DOM state,
  // before the browser's own inert-driven force-blur can run. Checking this in
  // an effect instead would be too late: per spec, applying `inert` to a
  // subtree that contains the focused element blurs it synchronously as part
  // of that same DOM mutation — by the time any effect runs, activeElement has
  // already moved to <body> and the "was it in here" signal is gone.
  const pendingFocusRestoreRef = useRef(false);
  if (!open) {
    pendingFocusRestoreRef.current = panelRef.current?.contains(document.activeElement) ?? false;
  }

  // Mount content the instant it opens; keep it mounted through the close
  // transition, then unmount — so a compacted panel has no content in the DOM.
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    // Focus restoration: if focus was inside this panel when it closed (e.g.
    // the ✕ button, or a control the player was just using), `inert` below
    // would otherwise strand it — the browser force-blurs an inert subtree's
    // focus to <body>, which is a jarring "focus vanished" experience for a
    // keyboard/screen-reader user. Send it back to this panel's own edge tab
    // instead, which is a sensible, always-visible landing spot. Don't steal
    // focus if the close happened some other way (swipe gesture, clicking the
    // backdrop) — only reclaim focus that was actually about to be orphaned.
    if (pendingFocusRestoreRef.current) {
      pendingFocusRestoreRef.current = false;
      tabRef.current?.focus();
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
        ref={tabRef}
        type="button"
        data-testid={`edge-tab-${side}`}
        aria-expanded={open}
        aria-label={`${open ? "Collapse" : "Expand"} ${label}`}
        onClick={() => (open ? onClose() : onOpen())}
        onMouseEnter={onTabPointerEnter}
        className={`absolute top-1/2 z-30 flex h-16 w-8 -translate-y-1/2 flex-col items-center justify-center gap-1 border border-white/15 bg-[#08141e]/80 backdrop-blur-md transition-opacity ${edgeCls} ${tabRounded} ${
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

      {/* Expanded overlay panel. `inert` (not just `aria-hidden`) while closed —
          otherwise the header's resize/close buttons stay in the tab order and
          keyboard-focusable while translated off-screen and hidden from
          assistive tech, which is both an ARIA violation (focusable content
          inside an aria-hidden subtree) and a confusing keyboard-focus trap. */}
      <div
        ref={panelRef}
        data-testid={`edge-panel-${side}`}
        // /92 opacity let the persistent bottom dock's own tile labels
        // (which sits underneath the panel, full-height) ghost-bleed through
        // right where the panel's own last one or two rows render, reading as
        // a confusing double-exposure of ACTION NAME text (e.g. "WATER" from
        // the dock showing through behind this panel's own "BOOST" row) — most
        // visible in the compact ~350-430px-tall landscape range this panel
        // always spans. /97 keeps the glassmorphic see-through-ness (still not
        // fully opaque) while making that bleed-through imperceptible.
        className={`absolute inset-y-0 z-40 flex flex-col border-white/10 bg-[#050d15]/97 shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-out ${panelEdgeCls} ${
          open
            ? "translate-x-0"
            : side === "left"
              ? "-translate-x-[calc(100%+8px)]"
              : "translate-x-[calc(100%+8px)]"
        }`}
        style={{ width: widthPx, boxShadow: `0 0 40px rgba(${accent},0.12)` }}
        aria-hidden={!open}
        inert={!open}
      >
        <div className="flex flex-none items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
          <h2 className="flex items-center gap-1.5 text-[11px] font-extrabold tracking-[0.16em]" style={{ color: `rgb(${accent})` }}>
            <span aria-hidden>{icon}</span> {label.toUpperCase()}
          </h2>
          <div className="flex items-center gap-1">
            {/* Desktop resize preset cycle (S/M/L) — a fixed-preset stand-in for
                free drag-resize; see GameShell.tsx for the tradeoff note. The
                "⤡" glyph + a width-in-px tooltip is a small affordance nudge
                (not a functional drag handle) so the control reads as "this
                resizes the panel" rather than an unlabeled size toggle. */}
            <button
              type="button"
              onClick={onCycleWidth}
              title={`Panel width: ${widthPx}px — click to cycle S / M / L`}
              aria-label="Cycle panel width"
              // min-h/min-w-9 (36px) instead of the old text-hugging px-1.5 py-0.5
              // box (~19x19px, well under a comfortable touch target) — this
              // control is reachable on touch landscape widths (the `sm:`
              // breakpoint is a viewport-width gate, not touch/mouse-specific),
              // so it needs a real tap target, not just a mouse-hover nicety.
              className="hidden min-h-9 min-w-9 items-center justify-center gap-1 rounded-md border border-white/15 px-1.5 font-mono text-[9px] font-bold text-white/60 hover:border-white/30 hover:text-white sm:inline-flex"
            >
              <span aria-hidden className="text-[8px] leading-none opacity-70">
                ⤡
              </span>
              {["S", "M", "L"][widthIndex]}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={`Close ${label}`}
              // Same touch-target fix as the resize button above: the old
              // px-2 py-0.5 box measured ~27x22px at real landscape widths —
              // under the ~44px ergonomic floor. min-h/min-w-9 (36px) is the
              // largest bump that still fits this panel's compact header row
              // without eating into the (already scroll-constrained) body at
              // short landscape heights.
              className="flex min-h-9 min-w-9 items-center justify-center rounded-md border border-white/15 text-[11px] font-bold text-white/70 hover:border-white/30 hover:text-white"
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
