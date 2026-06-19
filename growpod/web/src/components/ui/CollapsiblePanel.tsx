"use client";

// A reusable collapsible "panel" matching the Command Center HUD shell
// (`.panel` + a tracking-wide header). The header is a toggle; the body slides
// open/closed via the grid-rows 1fr↔0fr technique (animates to natural height,
// no magic max-height). Defaults OPEN so existing layouts are unchanged until a
// user toggles. Respects prefers-reduced-motion (snaps instead of sliding).

import { useId, useState, type ReactNode } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

export function CollapsiblePanel({
  title,
  titleClassName = "text-cyan-300",
  action,
  defaultOpen = true,
  className = "",
  children,
}: {
  title: ReactNode;
  /** Color/voice of the header label (e.g. grow-300 for DNA, cyan-300 for env). */
  titleClassName?: string;
  /** Optional right-aligned header element (badge, stage label). Stays visible when collapsed. */
  action?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const reduced = usePrefersReducedMotion();
  const bodyId = useId();

  return (
    <section className={`panel flex flex-col rounded-xl p-3 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex min-w-0 items-center gap-1.5 text-left"
        >
          <span
            className={`select-none text-[10px] text-cyan-200/50 ${reduced ? "" : "transition-transform duration-200"} ${open ? "rotate-90" : ""}`}
            aria-hidden
          >
            ▸
          </span>
          <h3 className={`truncate text-[11px] font-bold tracking-[0.2em] ${titleClassName}`}>{title}</h3>
        </button>
        {action}
      </div>

      <div
        id={bodyId}
        className={`grid ${reduced ? "" : "transition-[grid-template-rows] duration-300 ease-out"} ${
          open ? "mt-2 grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        {/* min-h-0 + overflow-hidden lets the 0fr row fully collapse the content. */}
        <div className="min-h-0 overflow-hidden">{children}</div>
      </div>
    </section>
  );
}
