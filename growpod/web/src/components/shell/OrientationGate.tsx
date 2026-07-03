"use client";

// Real landscape lock — blocks the game shell underneath entirely while a
// handheld device is in portrait, rather than letting a CSS media query just
// reflow a cramped portrait layout. See `useOrientationLock` for the actual
// detection (Screen Orientation API + matchMedia, not a guess from CSS).
//
// Per the owner's landscape-mobile mockup (growverse-landscape-mobile-hud-
// concept.png): "This game is designed for landscape play only" — the HUD is
// landscape-native (desktop-matched controls, just touch-triggered), not a
// portrait layout that reflows. The copy below says so explicitly.

import { useOrientationLock } from "@/hooks/useOrientationLock";

export function OrientationGate({ children }: { children: React.ReactNode }) {
  const { isPortrait, isHandheld } = useOrientationLock();
  const blocked = isPortrait && isHandheld;

  return (
    <>
      {/* The shell only ever mounts once we're confirmed landscape (or on a
          desktop rig, where we don't gate at all) — nothing playable renders
          underneath the prompt. */}
      {!blocked && children}
      {blocked && (
        <div
          role="alertdialog"
          aria-label="Landscape only — rotate your device to keep playing"
          className="fixed inset-0 z-[999] flex flex-col items-center justify-center gap-5 bg-[#050b12] px-8 text-center text-[#cfeeff]"
        >
          <div className="gpe-rotate-icon relative flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-cyan-400/60 text-4xl">
            📱
          </div>
          <h1 className="text-lg font-extrabold tracking-[0.08em] text-white">Turn your phone sideways</h1>
          <p className="max-w-[22rem] text-sm leading-relaxed text-cyan-200/70">
            This game is designed for landscape play only. Rotate to landscape
            for the full desktop-matched HUD — actions on the left, insights on
            the right, your plant chamber always front and center.
          </p>
          <div className="flex items-center gap-2 text-2xl" aria-hidden>
            <span>📴</span>
            <span className="text-cyan-300">→</span>
            <span className="rotate-90">📱</span>
          </div>
        </div>
      )}
    </>
  );
}
