"use client";

// Phase 4 — Master Grower chat panel. A grounded, FREE coach: every substantive
// answer shows the sources it cited (citation chips); refusals show their
// disclaimer; suggested care actions surface as chips. Read-only — it never
// mutates the game (the bot's tools are reads), so this is purely informational.

import { useEffect, useRef, useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { titleCase } from "@/lib/format";
import type { MasterGrowerReport } from "@/lib/types";
import { isSpeechSupported, LectureSpeaker, toCues } from "@/lib/university/browserSpeech";

interface Msg {
  role: "user" | "bot";
  text: string;
  report?: MasterGrowerReport;
}

/** "strain_knowledge:blue-dream" → "blue-dream"; "plant_state" → "plant state". */
function citationLabel(source: string): string {
  const [, rest] = source.split(":");
  return (rest ?? source).replace(/_/g, " ");
}

export function BotChatPanel({ plantId }: { plantId?: string }) {
  const { playerId } = useSession();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // FREE browser-voice read-aloud for the coach's answers (no key). `speakingIdx`
  // is the message currently being spoken, or -1. Resolved after mount (no SSR).
  const [canSpeak, setCanSpeak] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState(-1);
  const speakerRef = useRef<LectureSpeaker | null>(null);
  useEffect(() => setCanSpeak(isSpeechSupported()), []);
  useEffect(() => () => speakerRef.current?.stop(), []);

  function toggleSpeak(i: number, text: string) {
    if (speakingIdx === i) {
      speakerRef.current?.stop();
      return;
    }
    speakerRef.current?.stop();
    const speaker = new LectureSpeaker("Master Grower", {
      onState: (s) => {
        if (s === "idle") setSpeakingIdx(-1);
      },
      onEnd: () => setSpeakingIdx(-1),
    });
    speakerRef.current = speaker;
    speaker.start(toCues(text));
    setSpeakingIdx(i);
  }

  async function send() {
    const q = input.trim();
    if (!q || !playerId || loading) return;
    setInput("");
    setError(null);
    setMessages((m) => [...m, { role: "user", text: q }]);
    setLoading(true);
    try {
      const report = await api.university.askMasterGrower(playerId, q, plantId);
      setMessages((m) => [...m, { role: "bot", text: report.answer, report }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The Master Grower is unavailable.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Master Grower"
        subtitle="A free, grounded coach. Ask about a strain or a plant you're growing."
      />

      <div className="mb-3 flex-1 space-y-3 overflow-y-auto" aria-live="polite">
        {messages.length === 0 && (
          <p className="text-sm text-gray-500">
            Try “Tell me about Blue Dream” or, with a plant selected, “What’s wrong with my plant?”
          </p>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-auto max-w-[85%] rounded-lg bg-grow-900/60 px-3 py-2 text-sm text-grow-100">
              {m.text}
            </div>
          ) : (
            <div key={i} className="max-w-[90%] space-y-2 rounded-lg bg-ink-800 px-3 py-2">
              <div className="flex items-start gap-2">
                <p className="flex-1 text-sm text-gray-200">{m.text}</p>
                {canSpeak && (
                  <button
                    type="button"
                    onClick={() => toggleSpeak(i, m.text)}
                    aria-label={speakingIdx === i ? "Stop reading aloud" : "Read this answer aloud"}
                    title={speakingIdx === i ? "Stop" : "Read aloud"}
                    className="shrink-0 rounded-full border border-ink-600 bg-ink-700 px-2 py-0.5 text-xs text-gray-300 hover:bg-ink-600"
                  >
                    {speakingIdx === i ? "⏹" : "🔊"}
                  </button>
                )}
              </div>
              {m.report?.disclaimer && (
                <p className="rounded border border-amber-700/50 bg-amber-950/40 px-2 py-1 text-xs text-amber-200">
                  {m.report.disclaimer}
                </p>
              )}
              {m.report && m.report.citations.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {m.report.citations.map((c, j) => (
                    <span
                      key={j}
                      className="rounded border border-ink-600 bg-ink-700 px-1.5 py-0.5 text-[10px] text-gray-300"
                      title={c.snippet}
                    >
                      🔖 {citationLabel(c.source)}
                    </span>
                  ))}
                </div>
              )}
              {m.report && m.report.suggested_actions.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {m.report.suggested_actions.map((a, j) => (
                    <span
                      key={j}
                      className="rounded-full border border-grow-700 bg-grow-950/50 px-2 py-0.5 text-xs text-grow-200"
                    >
                      {titleCase(a.replace(/_/g, " "))}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ),
        )}
        {loading && <p className="text-sm text-gray-500">The Master Grower is thinking…</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the Master Grower…"
          aria-label="Ask the Master Grower"
          className="flex-1 rounded-md border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:border-grow-600 focus:outline-none"
        />
        <Button type="submit" disabled={loading || !input.trim()}>
          Ask
        </Button>
      </form>
    </Card>
  );
}
