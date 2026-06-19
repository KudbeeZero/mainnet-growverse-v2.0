"use client";

// The visual + interaction layer for the guided tutorial. Spotlights a real UI
// element by its `data-onboarding` attribute: dims everything *around* it with
// four strips (leaving the target itself uncovered and fully clickable), draws a
// glow ring, and floats an instruction bubble that never overlaps the target and
// always stays inside the viewport. Falls back to a centered card if the target
// can't be found (e.g. not rendered yet, or it lives in a protected file).

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { OnboardingStep } from "@/lib/onboarding/steps";

const PAD = 6; // highlight padding around the target
const MARGIN = 12; // min gap from viewport edges
const GAP = 12; // gap between target and bubble
const FIND_TIMEOUT_MS = 6000;

/** First on-screen (visible) element carrying the given data-onboarding value. */
function resolveTarget(name: string): HTMLElement | null {
  const els = Array.from(
    document.querySelectorAll<HTMLElement>(`[data-onboarding="${name}"]`),
  );
  return (
    els.find((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && el.offsetParent !== null;
    }) ?? null
  );
}

interface Props {
  step: OnboardingStep;
  index: number;
  total: number;
  onAdvance: () => void;
  onSkip: () => void;
}

export function OnboardingOverlay({ step, index, total, onAdvance, onSkip }: Props) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [fallback, setFallback] = useState(false);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const [bubblePos, setBubblePos] = useState<{ top: number; left: number } | null>(null);

  const centered = !step.target; // welcome / finish
  const showNext =
    centered || fallback || step.advance.kind === "next" || step.allowNext === true;

  // ── Resolve + track the target element for this step ──────────────────────
  useEffect(() => {
    setRect(null);
    setFallback(false);
    setBubblePos(null);
    if (!step.target) return;

    let raf = 0;
    let stop = false;
    const start = Date.now();
    const targetName = step.target;

    const measure = () => {
      const el = resolveTarget(targetName);
      if (el) {
        const r = el.getBoundingClientRect();
        // Scroll an off-screen target into view, then re-measure next frame.
        if (r.top < MARGIN || r.bottom > window.innerHeight - MARGIN) {
          el.scrollIntoView({ block: "center", behavior: "smooth" });
        }
        setRect(el.getBoundingClientRect());
        return true;
      }
      return false;
    };

    const tick = () => {
      if (stop) return;
      if (measure()) {
        raf = requestAnimationFrame(tick); // keep tracking position
      } else if (Date.now() - start > FIND_TIMEOUT_MS) {
        setFallback(true); // give up → centered card + Next
      } else {
        raf = requestAnimationFrame(tick);
      }
    };
    tick();

    return () => {
      stop = true;
      cancelAnimationFrame(raf);
    };
  }, [step.target, step.id]);

  // ── Advance when the player performs the required action on the target ─────
  useEffect(() => {
    if (!step.target || fallback) return;
    const kind = step.advance.kind;
    if (kind !== "click" && kind !== "change") return; // route kinds handled by provider
    const el = resolveTarget(step.target);
    if (!el) return;
    const evt = kind === "change" ? "change" : "click";
    const handler = () => onAdvance();
    el.addEventListener(evt, handler);
    return () => el.removeEventListener(evt, handler);
  }, [step.target, step.advance.kind, fallback, rect, onAdvance]);

  // ── Position the instruction bubble near the target, clamped to viewport ───
  const reposition = useCallback(() => {
    const bubble = bubbleRef.current;
    if (!bubble) return;
    const bw = bubble.offsetWidth;
    const bh = bubble.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (centered || fallback || !rect) {
      setBubblePos({ top: Math.max(MARGIN, (vh - bh) / 2), left: Math.max(MARGIN, (vw - bw) / 2) });
      return;
    }

    const roomBelow = vh - rect.bottom;
    const roomAbove = rect.top;
    const wantTop = step.placement === "top" || (step.placement !== "bottom" && roomBelow < bh + GAP + MARGIN && roomAbove > roomBelow);

    let top = wantTop ? rect.top - bh - GAP : rect.bottom + GAP;
    // If neither above nor below fits, dock to the side with most room.
    if (top < MARGIN || top + bh > vh - MARGIN) {
      top = Math.min(Math.max(MARGIN, rect.top), vh - bh - MARGIN);
    }
    let left = rect.left + rect.width / 2 - bw / 2; // centered on target
    left = Math.min(Math.max(MARGIN, left), vw - bw - MARGIN);
    setBubblePos({ top: Math.max(MARGIN, top), left });
  }, [centered, fallback, rect, step.placement]);

  useLayoutEffect(() => {
    reposition();
  }, [reposition, rect, fallback]);

  useEffect(() => {
    const onMove = () => reposition();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [reposition]);

  const spotlight = !centered && !fallback && rect;

  return (
    <div className="fixed inset-0 z-[60]" aria-live="polite" role="dialog" aria-label="Tutorial">
      {spotlight ? (
        <>
          {/* Four dim strips around the target — the target hole stays uncovered
              and clickable; the strips block stray clicks elsewhere. */}
          <Dim style={{ top: 0, left: 0, width: "100%", height: Math.max(0, rect.top - PAD) }} />
          <Dim style={{ top: rect.bottom + PAD, left: 0, width: "100%", bottom: 0 }} />
          <Dim style={{ top: rect.top - PAD, left: 0, width: Math.max(0, rect.left - PAD), height: rect.height + PAD * 2 }} />
          <Dim style={{ top: rect.top - PAD, left: rect.right + PAD, right: 0, height: rect.height + PAD * 2 }} />
          {/* Glow ring (doesn't capture clicks). */}
          <div
            className="pointer-events-none fixed rounded-lg ring-2 ring-grow-400 animate-pulse"
            style={{
              top: rect.top - PAD,
              left: rect.left - PAD,
              width: rect.width + PAD * 2,
              height: rect.height + PAD * 2,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.01), 0 0 18px 4px rgba(122,216,79,0.45)",
            }}
          />
        </>
      ) : (
        // Centered / fallback: a single full dim that captures clicks.
        <div className="fixed inset-0 bg-black/70" />
      )}

      {/* Instruction bubble. */}
      <div
        ref={bubbleRef}
        className="fixed w-[min(90vw,22rem)] rounded-xl border border-grow-700 bg-ink-800 p-4 shadow-glow-soft pointer-events-auto"
        style={bubblePos ? { top: bubblePos.top, left: bubblePos.left } : { opacity: 0, top: 0, left: 0 }}
      >
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-grow-300">
          Step {index + 1} of {total}
        </div>
        <p className="text-sm leading-relaxed text-gray-100">{step.text}</p>
        {fallback && step.target && (
          <p className="mt-2 text-[11px] text-gray-400">
            (We couldn’t spotlight that yet — press Next to continue.)
          </p>
        )}
        <div className="mt-3 flex items-center justify-between gap-3">
          <button
            onClick={onSkip}
            className="text-xs text-gray-500 underline-offset-2 hover:text-gray-300 hover:underline"
          >
            Skip tutorial
          </button>
          {showNext ? (
            <button
              onClick={onAdvance}
              className="rounded-md bg-grow-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-grow-500"
            >
              {index === total - 1 ? "Finish" : "Next"}
            </button>
          ) : (
            <span className="text-xs text-grow-300">↑ do this to continue</span>
          )}
        </div>
      </div>
    </div>
  );
}

function Dim({ style }: { style: CSSProperties }) {
  return (
    <div
      className="fixed bg-black/70"
      style={style}
      onClick={(e) => e.stopPropagation()}
      aria-hidden
    />
  );
}
