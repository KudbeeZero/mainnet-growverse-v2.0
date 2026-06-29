"use client";

// Arcade Mode — procedural sound (Web Audio API, no audio files).
//
// All sounds are synthesised on demand. Gated behind NEXT_PUBLIC_ARCADE_SOUND
// (default OFF) and a user gesture (AudioContext starts suspended until the first
// boost tap calls resumeAudio()). Muted when the user prefers reduced motion (used
// here as a proxy for sensory sensitivity). Fully no-op on the server.

const SOUND_FLAG = process.env.NEXT_PUBLIC_ARCADE_SOUND === "true";

let ctx: AudioContext | null = null;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** True when sound may play at all (flag on, in a browser, motion allowed). */
export function isSoundEnabled(): boolean {
  return SOUND_FLAG && typeof window !== "undefined" && !prefersReducedMotion();
}

function getCtx(): AudioContext | null {
  if (!isSoundEnabled()) return null;
  if (ctx) return ctx;
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

/** Resume the AudioContext from a user gesture (call on the first boost tap). */
export function resumeAudio(): void {
  const c = getCtx();
  if (c && c.state === "suspended") void c.resume();
}

/** One enveloped oscillator tone. start/end let us sweep frequency. */
function tone(
  c: AudioContext,
  type: OscillatorType,
  startHz: number,
  endHz: number,
  startAt: number,
  durSec: number,
  peak: number,
): void {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(startHz, startAt);
  if (endHz !== startHz) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endHz), startAt + durSec);
  // Quick attack, smooth release.
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + Math.min(0.05, durSec * 0.25));
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durSec);
  osc.connect(gain).connect(c.destination);
  osc.start(startAt);
  osc.stop(startAt + durSec + 0.02);
}

/** Boost applied: short ascending sine sweep 440→880Hz. */
export function playBoostApply(): void {
  const c = getCtx();
  if (!c) return;
  tone(c, "sine", 440, 880, c.currentTime, 0.2, 0.3);
}

/** Stage unlock: three-note ascending chord (C4-E4-G4). */
export function playStageUnlock(): void {
  const c = getCtx();
  if (!c) return;
  const notes = [261.63, 329.63, 392.0]; // C4 E4 G4
  notes.forEach((hz, i) => tone(c, "triangle", hz, hz, c.currentTime + i * 0.1, 0.18, 0.22));
}

/** Rewind engaged: descending sawtooth warble 880→220Hz. */
export function playRewindActive(): void {
  const c = getCtx();
  if (!c) return;
  tone(c, "sawtooth", 880, 220, c.currentTime, 0.3, 0.2);
}
