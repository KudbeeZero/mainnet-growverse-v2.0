"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  CARE_REACTIONS,
  CARE_REACTION_EVENT,
  type ReactionKind,
} from "./careReactionsData";

interface Active {
  key: number;
  kind: ReactionKind;
}

/**
 * The plant's visible response to a care action — mount this inside the
 * `relative` container that wraps a plant render (chamber stage, detail card).
 * It listens for `CARE_REACTION_EVENT` (dispatched by `CareButtons`) and plays
 * the zone-targeted animation mapped in `careReactionsData.ts`: water pulses
 * the root zone, feed rises up the stem, prune sparkles, train draws branch
 * guides, inspect sweeps a scanner line.
 *
 * `auto` plays one reaction on mount (e.g. `auto="inspect"` on the plant
 * detail page, so arriving via 🔍 Inspect feels like a scan starting).
 * Respects `prefers-reduced-motion`: reactions collapse to a brief static
 * tint wash, no travel.
 */
export function PlantReactionLayer({ auto }: { auto?: ReactionKind }) {
  const [active, setActive] = useState<Active[]>([]);
  const seq = useRef(0);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const play = (kind: ReactionKind) => {
      const key = ++seq.current;
      setActive((a) => [...a, { key, kind }]);
      const dur = reduced.current ? 500 : CARE_REACTIONS[kind].dur;
      window.setTimeout(() => setActive((a) => a.filter((x) => x.key !== key)), dur);
    };

    const onEvent = (e: Event) => play((e as CustomEvent<ReactionKind>).detail);
    window.addEventListener(CARE_REACTION_EVENT, onEvent);
    if (auto) play(auto);
    return () => window.removeEventListener(CARE_REACTION_EVENT, onEvent);
  }, [auto]);

  if (active.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden>
      {active.map(({ key, kind }) => (
        <Reaction key={key} kind={kind} reduced={reduced.current} />
      ))}
    </div>
  );
}

function Reaction({ kind, reduced }: { kind: ReactionKind; reduced: boolean }) {
  const r = CARE_REACTIONS[kind];
  const tintVar = { "--gpe-react-tint": r.tint } as CSSProperties;

  // Reduced motion: one gentle zone-tinted wash, no travel.
  if (reduced) {
    return (
      <div
        data-testid={`plant-reaction-${kind}`}
        className={`gpe-care-fade absolute inset-x-0 ${
          r.zone === "roots" ? "bottom-0 h-1/4" : r.zone === "canopy" ? "top-0 h-1/2" : "inset-y-0"
        }`}
        style={{ ...tintVar, background: `radial-gradient(60% 60% at 50% 50%, ${r.tint}, transparent 75%)` }}
      />
    );
  }

  switch (r.motion) {
    case "pulse": // water → expanding rings out of the root zone
      return (
        <div data-testid={`plant-reaction-${kind}`} className="absolute inset-x-0 bottom-0 h-1/3" style={tintVar}>
          <span className="gpe-react-ring absolute bottom-2 left-1/2 h-10 w-24 -translate-x-1/2" />
          <span className="gpe-react-ring absolute bottom-2 left-1/2 h-10 w-24 -translate-x-1/2" style={{ animationDelay: "0.3s" }} />
          <div
            className="gpe-react-glow absolute inset-0"
            style={{ background: `radial-gradient(70% 100% at 50% 100%, ${r.tint}, transparent 70%)` }}
          />
        </div>
      );
    case "rise": // feed → a pulse travelling up the stem line
      return (
        <div data-testid={`plant-reaction-${kind}`} className="absolute inset-y-0 left-1/2 w-10 -translate-x-1/2" style={tintVar}>
          <span
            className="gpe-react-rise absolute bottom-0 left-1/2 h-16 w-3 -translate-x-1/2 rounded-full"
            style={{ background: `linear-gradient(0deg, transparent, ${r.tint}, transparent)` }}
          />
        </div>
      );
    case "sparkle": // prune → trim glints across the canopy
      return (
        <div data-testid={`plant-reaction-${kind}`} className="absolute inset-x-0 top-[8%] h-2/5" style={tintVar}>
          {[18, 42, 64, 80, 30].map((left, i) => (
            <span
              key={i}
              className="gpe-react-glint absolute text-base"
              style={{ left: `${left}%`, top: `${(i * 37) % 80}%`, animationDelay: `${i * 120}ms` }}
            >
              ✨
            </span>
          ))}
        </div>
      );
    case "guide": // train → branch-guide arcs bending out from the stem
      return (
        <svg
          data-testid={`plant-reaction-${kind}`}
          className="absolute inset-x-0 top-[10%] h-1/2 w-full"
          viewBox="0 0 100 60"
          preserveAspectRatio="none"
          style={tintVar}
        >
          <path d="M50 55 Q 42 30 18 18" className="gpe-react-guide" pathLength={1} />
          <path d="M50 55 Q 58 30 82 18" className="gpe-react-guide" pathLength={1} style={{ animationDelay: "0.25s" }} />
        </svg>
      );
    case "sweep": // inspect → scanner line sweeping top → bottom
      return (
        <div data-testid={`plant-reaction-${kind}`} className="absolute inset-0" style={tintVar}>
          <span
            className="gpe-react-sweep absolute inset-x-2 top-0 h-8"
            style={{ background: `linear-gradient(180deg, transparent, ${r.tint}, transparent)` }}
          />
        </div>
      );
    case "shimmer": // treatments/boost → soft zone-wide wash
    default:
      return (
        <div
          data-testid={`plant-reaction-${kind}`}
          className={`gpe-react-glow absolute inset-x-0 ${r.zone === "canopy" ? "top-0 h-1/2" : "inset-y-0"}`}
          style={{ ...tintVar, background: `radial-gradient(60% 60% at 50% 40%, ${r.tint}, transparent 75%)` }}
        />
      );
  }
}
