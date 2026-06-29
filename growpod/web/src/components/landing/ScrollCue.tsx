"use client";

// A small "scroll down" chevron cue. Bounces (CSS) unless motion is reduced.

export function ScrollCue({ href = "#login", label = "Enter" }: { href?: string; label?: string }) {
  return (
    <a
      href={href}
      className="group inline-flex flex-col items-center gap-1 text-gray-400 transition-colors hover:text-grow-300"
    >
      <span className="instrument-label">{label}</span>
      <span className="animate-bounce text-lg leading-none motion-reduce:animate-none" aria-hidden>
        ↓
      </span>
    </a>
  );
}
