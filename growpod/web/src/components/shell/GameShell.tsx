"use client";

/**
 * GameShell — the game-shell/HUD redesign per the owner mockups
 * (`docs/memory/design/mockups/growverse-{mobile,desktop}-hud-concept.png`).
 *
 * The plant/grow-chamber view (`hero`) is always the visible, focused thing.
 * Everything else — Actions & Controls (left) and Insights & Management
 * (right) — lives in glassmorphic edge overlays that slide out on demand and
 * auto-compact back to a slim edge tab afterward. They NEVER push or resize
 * the hero: they float on top of it (mirrors both mockups' "Compact
 * workspace" middle frame — chamber stays full-bleed, tabs sit at the edges).
 *
 * Mobile (touch): swipe in from the left/right screen edge to open; tap the
 * backdrop, swipe back out, or finish an action to auto-compact.
 * Desktop (mouse): hover or click the edge tab to expand ("Hover or click the
 * edge tab to reveal HUD" per the mockup); close via the ✕ button, the tab
 * toggle, or finishing an action (auto-compact) — there's no close-on-mouse-
 * leave timer, since the mockups never call for one and it only fights a
 * player moving the mouse across the panel to reach a control. A small S/M/L
 * control cycles a fixed set of width presets — see the note below on why
 * this isn't free drag-resize.
 *
 * A persistent bottom action dock (`bottomDock`) stays visible at every panel
 * state, mobile and desktop alike, per both mockups.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIsTouchDevice } from "@/hooks/useIsTouchDevice";
import { EdgePanel, WIDTH_PRESETS, type PanelSide } from "./EdgePanel";
import { GameShellProvider, type EdgeSide } from "./GameShellContext";

export interface EdgePanelDef {
  label: string;
  icon: string;
  /** rgb triplet, e.g. "56,189,248". */
  accent: string;
  content: React.ReactNode;
}

const EDGE_ZONE_PX = 28; // how close to the screen edge a touch must start to count as "from the edge"
const OPEN_THRESHOLD_PX = 46; // drag distance past the edge to trigger open
const CLOSE_THRESHOLD_PX = 40; // drag distance to trigger a swipe-close
const VERTICAL_TOLERANCE_PX = 36; // gestures with more vertical than this are treated as scrolls, not swipes

function widthKey(side: PanelSide) {
  return `growverse.hud.panelWidth.${side}`;
}

function readWidthIndex(side: PanelSide): number {
  if (typeof window === "undefined") return 1;
  const raw = window.localStorage.getItem(widthKey(side));
  const n = raw ? Number(raw) : 1;
  return Number.isFinite(n) && n >= 0 && n < WIDTH_PRESETS.length ? n : 1;
}

export function GameShell({
  hero,
  left,
  right,
  bottomDock,
}: {
  /** The always-visible chamber/pod view. */
  hero: React.ReactNode;
  left: EdgePanelDef;
  right: EdgePanelDef;
  /** Persistent bottom command dock (mobile + desktop). */
  bottomDock: React.ReactNode;
}) {
  const isTouch = useIsTouchDevice();
  const [openSide, setOpenSide] = useState<EdgeSide | null>(null);
  const [widthIdx, setWidthIdx] = useState<Record<PanelSide, number>>({ left: 1, right: 1 });
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setWidthIdx({ left: readWidthIndex("left"), right: readWidthIndex("right") });
  }, []);

  const cycleWidth = useCallback((side: PanelSide) => {
    setWidthIdx((prev) => {
      const next = (prev[side] + 1) % WIDTH_PRESETS.length;
      window.localStorage.setItem(widthKey(side), String(next));
      return { ...prev, [side]: next };
    });
  }, []);

  const open = useCallback((side: EdgeSide) => {
    setOpenSide(side);
  }, []);
  const close = useCallback((side: EdgeSide) => {
    setOpenSide((cur) => (cur === side ? null : cur));
  }, []);
  const collapseAll = useCallback(() => setOpenSide(null), []);

  // Desktop hover-to-expand: immediate, no grace-period close timer (see the
  // header note above on why the mockups don't call for close-on-mouse-leave).
  const onTabHoverEnter = (side: EdgeSide) => {
    if (isTouch) return;
    open(side);
  };

  // --- Mobile: swipe-from-edge gesture detection (plain pointer events — no
  // gesture-library dependency; none is already in package.json and this is a
  // simple drag-threshold, not worth adding one for). ---
  const touchState = useRef<{ x: number; y: number; edge: EdgeSide | null; handled: boolean } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!isTouch || e.pointerType === "mouse") return;
    const rect = rootRef.current?.getBoundingClientRect();
    const w = rect?.width ?? window.innerWidth;
    const x = e.clientX - (rect?.left ?? 0);
    let edge: EdgeSide | null = null;
    if (openSide === null) {
      if (x <= EDGE_ZONE_PX) edge = "left";
      else if (x >= w - EDGE_ZONE_PX) edge = "right";
    }
    touchState.current = { x: e.clientX, y: e.clientY, edge, handled: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isTouch || e.pointerType === "mouse") return;
    const st = touchState.current;
    if (!st || st.handled) return;
    const dx = e.clientX - st.x;
    const dy = e.clientY - st.y;
    if (Math.abs(dy) > VERTICAL_TOLERANCE_PX) return; // reads as a vertical scroll, ignore

    if (openSide === null && st.edge) {
      if (st.edge === "left" && dx > OPEN_THRESHOLD_PX) {
        st.handled = true;
        open("left");
      } else if (st.edge === "right" && dx < -OPEN_THRESHOLD_PX) {
        st.handled = true;
        open("right");
      }
      return;
    }

    if (openSide === "left" && dx < -CLOSE_THRESHOLD_PX) {
      st.handled = true;
      close("left");
    } else if (openSide === "right" && dx > CLOSE_THRESHOLD_PX) {
      st.handled = true;
      close("right");
    }
  };

  const onPointerUp = () => {
    touchState.current = null;
  };

  const shellApi = useMemo(() => ({ collapse: (side: EdgeSide) => close(side) }), [close]);

  return (
    <GameShellProvider value={shellApi}>
      <div
        ref={rootRef}
        data-testid="game-shell-root"
        className="relative h-full w-full touch-pan-y overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Hero — the grow chamber. Always full-bleed, never resized by panels. */}
        <div className="absolute inset-0">{hero}</div>

        {/* Backdrop: only present while a panel is open, and only intercepts
            taps on touch devices (mobile "tap outside to close"). On desktop
            there's no close-on-mouse-leave behavior, so a click-catching
            backdrop would just get in the way of interacting with the
            chamber — it's pointer-events-none there. */}
        {openSide && (
          <button
            type="button"
            aria-label="Close panel"
            onClick={collapseAll}
            className={`absolute inset-0 z-20 bg-black/20 ${isTouch ? "" : "pointer-events-none"}`}
          />
        )}

        <EdgePanel
          side="left"
          label={left.label}
          icon={left.icon}
          accent={left.accent}
          open={openSide === "left"}
          widthIndex={widthIdx.left}
          onOpen={() => open("left")}
          onClose={() => close("left")}
          onCycleWidth={() => cycleWidth("left")}
          onTabPointerEnter={() => onTabHoverEnter("left")}
        >
          {left.content}
        </EdgePanel>

        <EdgePanel
          side="right"
          label={right.label}
          icon={right.icon}
          accent={right.accent}
          open={openSide === "right"}
          widthIndex={widthIdx.right}
          onOpen={() => open("right")}
          onClose={() => close("right")}
          onCycleWidth={() => cycleWidth("right")}
          onTabPointerEnter={() => onTabHoverEnter("right")}
        >
          {right.content}
        </EdgePanel>

        {/* Persistent bottom command dock — visible in every panel state. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <div className="pointer-events-auto w-full max-w-3xl px-2">{bottomDock}</div>
        </div>
      </div>
    </GameShellProvider>
  );
}
