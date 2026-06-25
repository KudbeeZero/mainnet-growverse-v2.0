"use client";

// Phase 2 — professor presenter video on the course page. Shows the rendered
// talking-head video when the backend has one (HeyGen, once enabled); until
// then the deterministic mock returns no video_url, so we show the caption
// transcript and lean on the existing narration audio player above. Public
// read — no auth needed.

import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { api } from "@/lib/api";

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function CoursePresenterVideo({ courseKey }: { courseKey: string }) {
  const q = useQuery({
    queryKey: ["presenterVideo", courseKey],
    queryFn: () => api.university.presenterVideo(courseKey),
    staleTime: 5 * 60_000,
  });

  // Silent if unavailable (feature off / network) — it's an enhancement.
  if (q.isLoading || q.isError || !q.data) return null;
  const video = q.data;

  return (
    <Card>
      <CardHeader
        title="Professor video"
        subtitle="A faculty-led video lecture with captions."
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
        <p className="rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-gray-400">
          🎬 The video lecture is coming soon. Play the narration above and follow along with the
          transcript below.
        </p>
      )}

      {video.captions.length > 0 && (
        <ol className="mt-3 max-h-56 space-y-1 overflow-y-auto pr-1 text-sm" aria-label="Lecture transcript">
          {video.captions.map((cue, i) => (
            <li key={i} className="flex gap-2">
              <span className="shrink-0 tabular-nums text-gray-500">{fmtTime(cue.start_s)}</span>
              <span className="text-gray-300">{cue.text}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
