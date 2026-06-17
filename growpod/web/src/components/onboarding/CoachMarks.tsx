"use client";

// FTUE coach-marks layer — non-blocking contextual tips anchored to real
// dashboard elements (tagged `data-coach="…"`). Deliberately NOT a modal: the
// overlay is pointer-events-none except the tip card, so a player is never
// trapped if a target shifts, and the core care loop is never interrupted.
// Shows one tip at a time, remembers dismissal per player, and self-suppresses
// when the sequence is done. Runs only on the dashboard (mounted there), well
// after the full-screen `/ftue` takeover has handed off.

import { useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/session";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useCoachMarkStore } from "@/lib/coachMarkStore";
import { nextCoachMark, remainingCount, type CoachMarkDef } from "@/lib/coachMarks";

const EMPTY: string[] = [];

interface Placement {
  mark: CoachMarkDef;
  ring: { top: number; left: number; width: number; height: number };
  card: { top: number; left: number };
  remaining: number;
}

function hasTarget(target: string): boolean {
  if (typeof document === "undefined") return false;
  return !!document.querySelector(`[data-coach="${target}"]`);
}

export function CoachMarks({ marks }: { marks: CoachMarkDef[] }) {
  const { playerId } = useSession();
  const reduced = usePrefersReducedMotion();
  const dismissedMap = useCoachMarkStore((s) => s.dismissed);
  const dismiss = useCoachMarkStore((s) => s.dismiss);
  const dismissAll = useCoachMarkStore((s) => s.dismissAll);
  const [place, setPlace] = useState<Placement | null>(null);
  const lastKey = useRef("");

  // Stable array ref (avoids a fresh array each render → effect/loop churn).
  const dismissed = (playerId ? dismissedMap[playerId] : undefined) ?? EMPTY;

  useEffect(() => {
    if (!playerId) {
      setPlace(null);
      lastKey.current = "";
      return;
    }

    const CARD_W = 264;
    const CARD_H = 136;
    const GAP = 10;
    const PAD = 8;

    function compute() {
      const mark = nextCoachMark(marks, dismissed, hasTarget);
      const el = mark && document.querySelector(`[data-coach="${mark.target}"]`);
      if (!mark || !el) {
        if (lastKey.current !== "") {
          lastKey.current = "";
          setPlace(null);
        }
        return;
      }
      const r = el.getBoundingClientRect();
      const remaining = remainingCount(marks, dismissed, hasTarget);
      const key = `${mark.id}:${Math.round(r.top)}:${Math.round(r.left)}:${Math.round(r.width)}:${Math.round(r.height)}:${remaining}`;
      if (key === lastKey.current) return; // nothing moved — skip the re-render
      lastKey.current = key;

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const below = r.bottom + GAP;
      const placeAbove = below + CARD_H > vh - PAD && r.top - GAP - CARD_H > PAD;
      const top = Math.max(PAD, placeAbove ? r.top - GAP - CARD_H : below);
      const left = Math.max(PAD, Math.min(r.left + r.width / 2 - CARD_W / 2, vw - CARD_W - PAD));

      setPlace({
        mark,
        ring: { top: r.top, left: r.left, width: r.width, height: r.height },
        card: { top, left },
        remaining,
      });
    }

    compute();
    // Track the target while the page scrolls/resizes; the interval catches
    // late-arriving targets (a plant card landing from a query).
    const onMove = () => compute();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    const iv = window.setInterval(compute, 600);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
      window.clearInterval(iv);
    };
  }, [playerId, dismissed, marks]);

  // Esc dismisses the current tip.
  useEffect(() => {
    if (!place || !playerId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss(playerId, place.mark.id);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [place, playerId, dismiss]);

  if (!place || !playerId) return null;

  const { mark, ring, card, remaining } = place;
  const isLast = remaining <= 1;

  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      {/* highlight ring around the anchored target */}
      <div
        className={`absolute rounded-lg ring-2 ring-grow-400 ${reduced ? "" : "animate-pulse-ring"}`}
        style={{ top: ring.top - 4, left: ring.left - 4, width: ring.width + 8, height: ring.height + 8 }}
        aria-hidden
      />
      {/* the tip card — the only interactive part of the overlay */}
      <div
        role="dialog"
        aria-modal="false"
        aria-label={`Tip: ${mark.title}`}
        className={`pointer-events-auto absolute w-[264px] rounded-xl border border-grow-700 bg-ink-900/95 p-3 shadow-glow-soft backdrop-blur ${reduced ? "" : "animate-fade-up"}`}
        style={{ top: card.top, left: card.left }}
      >
        <div className="instrument-label mb-1 text-grow-300">Tip · {remaining} left</div>
        <div className="text-sm font-semibold text-gray-100">{mark.title}</div>
        <p className="mt-0.5 text-xs leading-relaxed text-gray-400">{mark.body}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => dismissAll(playerId)}
            className="rounded px-1.5 py-1 text-[11px] text-gray-500 hover:text-gray-300"
          >
            Skip tips
          </button>
          <button
            type="button"
            onClick={() => dismiss(playerId, mark.id)}
            className="rounded-md border border-grow-500 bg-grow-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-grow-500"
          >
            {isLast ? "Got it" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
