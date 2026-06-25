import { describe, it, expect } from "vitest";
import { pickVoice, isSpeechSupported, toCues, type VoiceLike } from "@/lib/university/browserSpeech";

const VOICES: VoiceLike[] = [
  { name: "Samantha", lang: "en-US" },
  { name: "Daniel", lang: "en-GB" },
  { name: "Karen", lang: "en-AU" },
  { name: "Amélie", lang: "fr-FR" },
  { name: "Anna", lang: "de-DE" },
];

describe("pickVoice", () => {
  it("is deterministic for a given key + voice list", () => {
    expect(pickVoice(VOICES, "Professor Flora")).toBe(pickVoice(VOICES, "Professor Flora"));
  });
  it("only picks English voices when any exist", () => {
    for (const name of ["Professor Flora", "Vera Lindqvist", "Dr. Mira Okafor", "Dr. Chem Torres"]) {
      const v = pickVoice(VOICES, name);
      expect(v).not.toBeNull();
      expect(v!.lang.toLowerCase().startsWith("en")).toBe(true);
    }
  });
  it("gives different professors different voices (spread across the pool)", () => {
    const names = ["Professor Flora", "Vera Lindqvist", "Dr. Sage Harlow", "Dr. Mira Okafor", "Dr. Chem Torres", "Dr. Petra Nance"];
    const chosen = new Set(names.map((n) => pickVoice(VOICES, n)!.name));
    expect(chosen.size).toBeGreaterThan(1);
  });
  it("falls back to the full list when no English voice exists", () => {
    const fr = [{ name: "Amélie", lang: "fr-FR" }];
    expect(pickVoice(fr, "anyone")!.name).toBe("Amélie");
  });
  it("returns null for an empty voice list", () => {
    expect(pickVoice([], "anyone")).toBeNull();
  });
});

describe("isSpeechSupported", () => {
  it("returns a boolean (false in the node test env, no window.speechSynthesis)", () => {
    expect(typeof isSpeechSupported()).toBe("boolean");
  });
});

describe("toCues", () => {
  it("splits prose into sentence cues, keeping terminators", () => {
    const cues = toCues("Water at the base. Don't soak the leaves! Why? It invites mold.");
    expect(cues.map((c) => c.text)).toEqual([
      "Water at the base.",
      "Don't soak the leaves!",
      "Why?",
      "It invites mold.",
    ]);
  });
  it("returns a single cue for terminator-free text, and nothing for empty", () => {
    expect(toCues("no period here")).toEqual([{ text: "no period here" }]);
    expect(toCues("   ")).toEqual([]);
  });
});
