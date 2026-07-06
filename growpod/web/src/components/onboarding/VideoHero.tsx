"use client";

// The public onboarding hero: a cinematic growth time-lapse of the branded Grow-Pod
// (owner-licensed render — xAI Creative Studio, cert GP-VG-2026-001). Muted autoplay
// loop so it plays without a gesture; `prefers-reduced-motion` falls back to the
// static pod still (also the video's poster), so it never auto-animates for users
// who opt out.

import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const POSTER = "/media/grow-pod-hero.jpg";
const VIDEO = "/media/grow-timelapse.mp4";

export function VideoHero({ className = "" }: { className?: string }) {
  const reducedMotion = usePrefersReducedMotion();
  const frame = `w-full rounded-2xl border border-cyan-400/15 bg-black ${className}`;

  if (reducedMotion) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={POSTER} alt="GrowVerse Grow-Pod — a cannabis plant growing in the pod" className={frame} />
    );
  }
  return (
    <video
      className={frame}
      src={VIDEO}
      poster={POSTER}
      preload="none"
      autoPlay
      muted
      loop
      playsInline
      aria-label="GrowVerse Grow-Pod growth time-lapse, seed to harvest"
    />
  );
}
