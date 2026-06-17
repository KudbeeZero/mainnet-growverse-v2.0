"use client";

// Slim announcements banner that sits in its own row ABOVE the hero — never
// overlapping the logo. Cycles through items; static for reduced-motion users;
// pauses on hover/focus (WCAG 2.2.2 — moving content needs a pause mechanism).
// Deliberately NOT aria-live: a forever-rotating live region would interrupt
// screen readers every cycle.

import { useEffect, useState } from "react";
import { announcements } from "@/lib/announcements";

export function AnnouncementsBanner({ className = "" }: { className?: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (announcements.length < 2 || paused) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % announcements.length), 7000);
    return () => clearInterval(t);
  }, [paused]);

  if (announcements.length === 0) return null;
  // Modulo guard: survives the list shrinking under HMR / future dynamic data.
  const item = announcements[index % announcements.length];

  return (
    <div
      role="region"
      aria-label="Announcements"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className={`flex items-center gap-3 rounded-lg border border-grow-700/40 bg-grow-900/20 px-3 py-2 ${className}`}
    >
      <span className="instrument-label shrink-0 text-grow-300/80">NEWS</span>
      <p className="min-w-0 flex-1 truncate text-xs text-gray-300 sm:text-sm" title={item.text}>
        {item.text}
      </p>
      {announcements.length > 1 && (
        <span className="instrument-label shrink-0 text-gray-600">
          {index + 1}/{announcements.length}
        </span>
      )}
    </div>
  );
}
