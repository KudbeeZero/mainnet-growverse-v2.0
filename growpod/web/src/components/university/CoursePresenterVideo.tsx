"use client";

// Phase 2 — free "Narrated Lecture Theater". A faculty avatar card + the existing
// ElevenLabs narration audio + karaoke-synced captions (the active line lights up
// and scrolls into view as the audio plays). Zero per-render cost — no HeyGen.
// If a real talking-head video_url ever arrives (a paid provider behind the same
// VideoPresenterProvider ABC), we show that instead. If no narration audio is
// available, it degrades to a readable timestamped transcript.

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { api } from "@/lib/api";
import { fmtTime, initials, hueFor, activeCueIndex } from "@/lib/university/lectureTheater";

export function CoursePresenterVideo({ courseKey }: { courseKey: string }) {
  const q = useQuery({
    queryKey: ["presenterVideo", courseKey],
    queryFn: () => api.university.presenterVideo(courseKey),
    staleTime: 5 * 60_000,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeRef = useRef<HTMLLIElement | null>(null);
  const [t, setT] = useState(0);
  const [audioOk, setAudioOk] = useState(true);

  const active = q.data ? activeCueIndex(q.data.captions, t) : -1;

  // Keep the active caption scrolled into view as the audio advances.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [active]);

  // Silent if unavailable (feature off / network) — it's an enhancement.
  if (q.isLoading || q.isError || !q.data) return null;
  const video = q.data;
  const hue = hueFor(video.presenter_name);
  const audioUrl = `/api/game/university/courses/${courseKey}/audio`;

  return (
    <Card>
      <CardHeader
        title="Narrated lecture"
        subtitle={`${video.presenter_name} walks you through this course.`}
        action={
          <Badge className="border-ink-600 bg-ink-700 text-[10px] text-gray-400">
            {video.provider}
          </Badge>
        }
      />

      {video.video_url ? (
        <video
          controls
          poster={video.poster_url ?? undefined}
          src={video.video_url}
          className="aspect-video w-full rounded-lg bg-black"
        >
          <track kind="captions" label="English" default />
        </video>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-ink-600 bg-ink-800 p-3">
          {/* Deterministic CSS avatar — no image-gen cost. */}
          <div
            aria-hidden
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
            style={{ backgroundColor: `hsl(${hue} 45% 38%)` }}
          >
            {initials(video.presenter_name)}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-100">{video.presenter_name}</p>
            {audioOk ? (
              <audio
                ref={audioRef}
                controls
                src={audioUrl}
                preload="none"
                onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
                onError={() => setAudioOk(false)}
                className="mt-1 h-8 w-full"
              />
            ) : (
              <p className="mt-0.5 text-xs text-gray-500">
                Audio is warming up — follow the transcript below.
              </p>
            )}
          </div>
        </div>
      )}

      {video.captions.length > 0 && (
        <ol className="mt-3 max-h-56 space-y-0.5 overflow-y-auto pr-1 text-sm" aria-label="Lecture transcript">
          {video.captions.map((cue, i) => (
            <li
              key={i}
              ref={i === active ? activeRef : null}
              className={`flex gap-2 rounded px-1.5 py-0.5 transition-colors ${
                i === active ? "bg-grow-900/70 text-grow-100" : "text-gray-400"
              }`}
            >
              <span className="shrink-0 tabular-nums text-gray-500">{fmtTime(cue.start_s)}</span>
              <span>{cue.text}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
