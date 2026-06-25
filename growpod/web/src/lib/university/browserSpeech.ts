// FREE in-browser lecture narration (Web Speech API). No API key, no backend cost:
// the device's built-in voice reads a lecture's caption track aloud, cue-by-cue, so
// the karaoke highlight stays perfectly in sync (the active cue == the one being
// spoken) without relying on the cue timings. Degrades to a silent no-op where speech
// synthesis is unavailable — the transcript is still fully readable.
//
// The pure pieces (support check + voice picking) are unit-tested; the LectureSpeaker
// controller touches window.speechSynthesis and guards for its absence (SSR / no API).

export type SpeechState = "idle" | "speaking" | "paused";

/** Minimal shape we need from a SpeechSynthesisVoice (so the picker is testable). */
export interface VoiceLike {
  name: string;
  lang: string;
  default?: boolean;
}

/** A timed caption line — we only need its text to speak it. */
export interface CueLike {
  text: string;
}

/** Split free prose into sentence-sized cues so a long answer is spoken in short
 * utterances (avoids the Chrome long-utterance cutoff) — used for the coach's replies. */
export function toCues(text: string): CueLike[] {
  const parts = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  return parts.map((s) => s.trim()).filter(Boolean).map((t) => ({ text: t }));
}

/** Is browser text-to-speech available here? (false during SSR / on older browsers). */
export function isSpeechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance !== "undefined"
  );
}

/**
 * Deterministically choose an English voice for a speaker `key` (e.g. the professor's
 * name) — same key + same available voices → same voice, so each professor keeps a
 * stable, distinct voice across a session. Prefers `en-*` voices; falls back to the
 * full list, then null when there are none (caller lets the platform default pick).
 */
export function pickVoice<T extends VoiceLike>(voices: T[], key: string): T | null {
  if (!voices || voices.length === 0) return null;
  const en = voices.filter((v) => /^en([-_]|$)/i.test(v.lang));
  const pool = en.length ? en : voices;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return pool[h % pool.length];
}

/**
 * Speaks an ordered caption track one utterance per cue. `onCue(i)` fires as each cue
 * begins (drive the karaoke highlight off this); `onState` reports idle/speaking/paused;
 * `onEnd` fires once when the whole track finishes (not on stop()). All methods are safe
 * to call when speech is unsupported — they no-op.
 */
export class LectureSpeaker {
  private synth: SpeechSynthesis | null;
  private cues: CueLike[] = [];
  private i = 0;
  private stopped = false;
  private voiceKey: string;
  private opts: {
    onCue?: (i: number) => void;
    onState?: (s: SpeechState) => void;
    onEnd?: () => void;
    rate?: number;
    pitch?: number;
  };

  constructor(
    voiceKey: string,
    opts: {
      onCue?: (i: number) => void;
      onState?: (s: SpeechState) => void;
      onEnd?: () => void;
      rate?: number;
      pitch?: number;
    } = {},
  ) {
    this.synth = isSpeechSupported() ? window.speechSynthesis : null;
    this.voiceKey = voiceKey;
    this.opts = opts;
  }

  /** Begin narrating `cues` from the top. Cancels anything already speaking. */
  start(cues: CueLike[]): void {
    if (!this.synth || cues.length === 0) return;
    this.synth.cancel();
    this.cues = cues;
    this.i = 0;
    this.stopped = false;
    this.opts.onState?.("speaking");
    this.speakCurrent();
  }

  private resolveVoice(): SpeechSynthesisVoice | null {
    if (!this.synth) return null;
    const voices = this.synth.getVoices?.() ?? [];
    return pickVoice(voices as unknown as VoiceLike[], this.voiceKey) as
      | SpeechSynthesisVoice
      | null;
  }

  private speakCurrent(): void {
    if (!this.synth || this.stopped) return;
    if (this.i >= this.cues.length) {
      this.opts.onState?.("idle");
      this.opts.onEnd?.();
      return;
    }
    this.opts.onCue?.(this.i);
    const u = new SpeechSynthesisUtterance(this.cues[this.i].text);
    const v = this.resolveVoice();
    if (v) u.voice = v;
    u.rate = this.opts.rate ?? 1;
    u.pitch = this.opts.pitch ?? 1;
    u.onend = () => {
      if (this.stopped) return;
      this.i += 1;
      this.speakCurrent();
    };
    u.onerror = () => {
      // Skip a failed cue rather than stalling the whole lecture.
      if (this.stopped) return;
      this.i += 1;
      this.speakCurrent();
    };
    this.synth.speak(u);
  }

  pause(): void {
    if (!this.synth) return;
    this.synth.pause();
    this.opts.onState?.("paused");
  }

  resume(): void {
    if (!this.synth) return;
    this.synth.resume();
    this.opts.onState?.("speaking");
  }

  /** Stop and reset — does NOT fire onEnd. */
  stop(): void {
    this.stopped = true;
    this.synth?.cancel();
    this.opts.onState?.("idle");
  }
}
