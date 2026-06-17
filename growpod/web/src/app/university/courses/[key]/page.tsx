"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LoadingBlock } from "@/components/ui/Spinner";
import { ErrorState, EmptyState } from "@/components/ui/States";
import { Stat } from "@/components/ui/Metric";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useTranscript, usePlantsList } from "@/hooks/queries";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { queryKeys } from "@/lib/queryKeys";
import { grow, hours, titleCase } from "@/lib/format";

const LEVELS = ["beginner", "intermediate", "advanced"] as const;

function CourseInner({ courseKey }: { courseKey: string }) {
  const { playerId } = useSession();
  const transcript = useTranscript();

  const inv = [queryKeys.transcript(playerId ?? ""), queryKeys.wallet(playerId ?? ""), queryKeys.player(playerId ?? "")];
  const enroll = useApiMutation(() => api.university.enroll(playerId!, courseKey), {
    invalidate: inv,
    successMessage: "Enrolled",
  });
  const complete = useApiMutation(() => api.university.complete(playerId!, courseKey), {
    invalidate: inv,
    successMessage: "Course completed!",
  });

  if (transcript.isLoading) return <LoadingBlock />;
  if (transcript.isError || !transcript.data)
    return <ErrorState error={transcript.error} onRetry={() => transcript.refetch()} />;

  const course = transcript.data.courses.find((c) => c.key === courseKey);
  if (!course)
    return <EmptyState icon="❓" title="Unknown course" hint="This course isn't in the catalog." />;

  const dept = transcript.data.departments?.[course.department ?? ""] ?? course.department ?? "";
  const studyLeft = course.progress?.study_hours_remaining ?? 0;
  const practicalMet = course.progress?.practical_met ?? false;
  const canComplete = course.status === "enrolled" && studyLeft <= 0 && practicalMet;

  return (
    <div className="space-y-5">
      <Link href="/university" className="text-sm text-grow-300 hover:underline">
        ← Back to Catalog
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="instrument-label mb-1">{dept}</div>
          <h1 className="text-2xl font-bold text-gray-50">{course.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <CourseAudioPlayer courseKey={courseKey} />
          <Badge className="border-ink-600 bg-ink-700 text-gray-300">{titleCase(course.status)}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Coursework" />
          <div className="space-y-1">
            <Stat label="Level required" value={course.level_req} />
            <Stat label="Tuition" value={grow(course.tuition)} />
            <Stat label="Study time" value={hours(course.duration_hours)} />
            <Stat label="Credits" value={course.credits ?? "—"} />
            {course.prereqs.length > 0 && <Stat label="Prereqs" value={course.prereqs.join(", ")} />}
          </div>

          <div className="mt-4 space-y-3">
            {course.status === "available" && (
              <Button className="w-full" loading={enroll.isPending} onClick={() => enroll.mutate()}>
                Enroll · {grow(course.tuition)}
              </Button>
            )}

            {course.status === "enrolled" && (
              <div className="space-y-2 rounded-lg border border-ink-700 bg-ink-900/50 p-3 text-sm">
                <div className="instrument-label">PROGRESS</div>
                <Stat
                  label="Study"
                  value={studyLeft > 0 ? `${hours(studyLeft)} left` : "✓ complete"}
                />
                <Stat
                  label="Practical"
                  value={
                    practicalMet ? "✓ met" : course.progress?.practical ?? "in progress"
                  }
                />
                <Button
                  className="mt-1 w-full"
                  loading={complete.isPending}
                  disabled={!canComplete}
                  onClick={() => complete.mutate()}
                >
                  {canComplete ? "Complete course" : "Requirements not met"}
                </Button>
              </div>
            )}

            {course.status === "completed" && (
              <Badge className="border-grow-600 bg-grow-900/60 text-grow-200">✓ Completed</Badge>
            )}
            {course.status === "locked" && (
              <p className="text-xs text-gray-500">
                Locked — meet the level requirement and prerequisites first.
              </p>
            )}
          </div>

          {course.perks && Object.keys(course.perks).length > 0 && (
            <div className="mt-4">
              <div className="instrument-label mb-1">PERKS ON COMPLETION</div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(course.perks).map(([k, v]) => (
                  <span key={k} className="rounded-full border border-grow-700 bg-grow-900/40 px-2 py-0.5 text-xs text-grow-200">
                    {titleCase(k)}: {String(v)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>

        <div className="lg:col-span-2">
          <LectureReader courseKey={courseKey} topic={course.lecture_topic} />
        </div>
      </div>
    </div>
  );
}

// Average ElevenLabs generation time (seconds). Used for the progress estimate.
const AUDIO_GEN_ESTIMATE_S = 8;

function CourseAudioPlayer({ courseKey }: { courseKey: string }) {
  const [playing, setPlaying] = useState(false);
  // Optimistic default: show the button right away.  Hide it only when we
  // confirm audio is unavailable (no API key / 204 from the server).
  // "ready"       — preloaded and available; click plays instantly
  // "buffering"   — user clicked before canplaythrough; waiting on browser
  // "unavailable" — server returned 204; button is hidden
  const [status, setStatus] = useState<"ready" | "buffering" | "unavailable">("ready");
  // "generating" is true while the HEAD probe is slow (> 1 s) AND the server
  // header says the audio is a cache miss — i.e. being generated right now.
  const [generating, setGenerating] = useState(false);
  // Elapsed seconds since generating started — drives the progress bar.
  const [genElapsed, setGenElapsed] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const audioUrl = `/api/game/university/courses/${courseKey}/audio`;

  // On mount: start pre-loading the Audio element immediately (optimistic).
  // A background HEAD probe confirms availability; if the server returns 204
  // we tear down the element and hide the button.  When the prewarm cache is
  // warm the HEAD probe returns quickly and the audio is already buffered by
  // the time the user clicks — zero wait.
  useEffect(() => {
    let cancelled = false;

    // Create the element and start loading in parallel with the HEAD probe.
    const audio = new Audio(audioUrl);
    audio.preload = "auto";
    audioRef.current = audio;

    audio.addEventListener("ended", () => {
      if (!cancelled) setPlaying(false);
    });
    audio.addEventListener("error", () => {
      if (!cancelled) {
        setStatus("unavailable");
        audioRef.current = null;
      }
    });
    audio.load();

    // HEAD probe: measures response time and reads the cache-status header.
    // If the probe takes > 1 s we show a "generating" hint so the player
    // knows the delay is expected (first-time generation), not a hang.
    const probeStart = Date.now();
    const slowTimer = setTimeout(() => {
      if (!cancelled) setGenerating(true);
    }, 1000);

    fetch(audioUrl, { method: "HEAD" })
      .then((r) => {
        clearTimeout(slowTimer);
        if (cancelled) return;

        const cacheStatus = r.headers.get("X-Audio-Cache-Status");
        // Only keep the "generating" hint visible if the server confirmed
        // it was a live generation (miss) AND the probe actually took > 1 s.
        const wasSlow = Date.now() - probeStart > 1000;
        if (!wasSlow || cacheStatus !== "miss") {
          setGenerating(false);
        }

        if (r.status === 204 || !r.ok) {
          audio.pause();
          audio.src = "";
          audioRef.current = null;
          setStatus("unavailable");
          setGenerating(false);
        }
        // 200 → already loading; nothing extra to do.
      })
      .catch(() => {
        clearTimeout(slowTimer);
        setGenerating(false);
        // Network error — keep the button visible; worst case the audio element
        // fires its own error event and we hide then.
      });

    // Once the audio element buffers successfully, clear any generating hint.
    audio.addEventListener("canplaythrough", () => {
      if (!cancelled) setGenerating(false);
    }, { once: true });

    return () => {
      cancelled = true;
      clearTimeout(slowTimer);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, [audioUrl]);

  // Drive the countdown / progress bar while generation is in progress.
  useEffect(() => {
    if (!generating) {
      setGenElapsed(0);
      return;
    }
    setGenElapsed(0);
    const interval = setInterval(() => {
      setGenElapsed((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [generating]);

  function handlePlay() {
    if (status === "unavailable" || !audioRef.current) return;

    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
      return;
    }

    // If the browser hasn't buffered enough yet, wait for canplaythrough.
    if (audioRef.current.readyState < 3) {
      setStatus("buffering");
      audioRef.current.addEventListener(
        "canplaythrough",
        () => {
          setStatus("ready");
          setPlaying(true);
          audioRef.current?.play().catch(() => setPlaying(false));
        },
        { once: true },
      );
      audioRef.current.addEventListener(
        "error",
        () => {
          setStatus("unavailable");
          audioRef.current = null;
        },
        { once: true },
      );
      return;
    }

    audioRef.current.play().catch(() => setPlaying(false));
    setPlaying(true);
  }

  if (status === "unavailable") return null;

  const loading = status === "buffering";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handlePlay}
        disabled={loading}
        aria-label={playing ? "Pause professor narration" : "Play professor narration"}
        title={playing ? "Pause narration" : "Play professor narration"}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
          loading
            ? "border-ink-600 text-gray-500 cursor-wait"
            : playing
            ? "border-grow-500 bg-grow-900/40 text-grow-200"
            : "border-ink-600 bg-ink-800 text-gray-300 hover:border-grow-600 hover:text-grow-200"
        }`}
      >
        <span>{loading ? "⏳" : playing ? "⏸" : "🔊"}</span>
        <span>{loading ? "Loading…" : playing ? "Pause" : "Listen"}</span>
      </button>
      {generating && (
        <div className="w-full min-w-[140px] flex flex-col gap-1 items-end">
          <div className="w-full h-1 rounded-full bg-ink-700 overflow-hidden">
            {genElapsed < AUDIO_GEN_ESTIMATE_S ? (
              <div
                className="h-full rounded-full bg-grow-500 transition-all duration-1000 ease-linear"
                style={{ width: `${Math.min((genElapsed / AUDIO_GEN_ESTIMATE_S) * 100, 95)}%` }}
              />
            ) : (
              <div className="h-full w-full rounded-full bg-grow-500 animate-pulse" />
            )}
          </div>
          <p className="text-[10px] text-gray-500 leading-tight">
            {genElapsed < AUDIO_GEN_ESTIMATE_S
              ? `Generating audio… ~${AUDIO_GEN_ESTIMATE_S - genElapsed}s remaining`
              : "Almost ready…"}
          </p>
        </div>
      )}
    </div>
  );
}

function LectureReader({ courseKey, topic }: { courseKey: string; topic: string | null }) {
  const { playerId } = useSession();
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("beginner");
  const [plantId, setPlantId] = useState<string>("");
  const [open, setOpen] = useState(false);
  const plants = usePlantsList();

  const lecture = useQuery({
    queryKey: [...queryKeys.lecture(playerId ?? "", courseKey, level), plantId],
    queryFn: () => api.university.lecture(playerId!, courseKey, { level, plant_id: plantId || undefined }),
    enabled: open && !!playerId,
    staleTime: 60_000,
  });

  return (
    <Card>
      <CardHeader
        title="The Professor's lecture"
        subtitle={topic ? `Topic: ${topic}` : "AI-delivered lecture"}
        action={lecture.data?.provider ? <Badge className="border-ink-600 bg-ink-700 text-[10px] text-gray-400">{lecture.data.provider}</Badge> : undefined}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {LEVELS.map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`rounded-md px-2.5 py-1 text-xs ${
                level === l ? "bg-grow-700 text-white" : "bg-ink-700 text-gray-300 hover:bg-ink-600"
              }`}
            >
              {titleCase(l)}
            </button>
          ))}
        </div>
        {(plants.data ?? []).length > 0 && (
          <select
            value={plantId}
            onChange={(e) => setPlantId(e.target.value)}
            aria-label="Plant context for lecture"
            className="rounded-md border border-ink-600 bg-ink-900 px-2 py-1 text-xs text-gray-200"
          >
            <option value="">No plant context</option>
            {(plants.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                Plant {p.id.slice(0, 6)}… ({titleCase(p.growth_stage)})
              </option>
            ))}
          </select>
        )}
        <Button size="sm" variant="secondary" onClick={() => { setOpen(true); lecture.refetch(); }}>
          {lecture.data ? "Re-deliver" : "Attend lecture"}
        </Button>
      </div>

      {!open && (
        <p className="text-sm text-gray-500">
          Pick a level (and optionally a live plant for a contextual lecture), then attend.
        </p>
      )}
      {open && lecture.isLoading && <LoadingBlock label="The Professor is preparing…" />}
      {open && lecture.isError && (
        <p className="text-sm text-red-300">{(lecture.error as Error)?.message ?? "Professor unavailable"}</p>
      )}
      {lecture.data && (
        <article className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-50">{lecture.data.title}</h3>
          <p className="text-sm italic text-gray-400">{lecture.data.summary}</p>

          {/* 🎙 Audio player — only shown when ElevenLabs key is set server-side */}
          {lecture.data.audio_url && (
            <div className="flex items-center gap-3 rounded-lg border border-grow-800 bg-grow-950/40 px-3 py-2">
              <span className="text-base">🎙</span>
              <audio
                controls
                src={lecture.data.audio_url}
                className="h-8 w-full"
                aria-label="Professor audio narration"
              />
            </div>
          )}

          <div className="space-y-2 whitespace-pre-line text-sm leading-relaxed text-gray-300">
            {lecture.data.content}
          </div>
          {lecture.data.key_takeaways.length > 0 && (
            <div className="rounded-lg border border-ink-700 bg-ink-900/50 p-3">
              <div className="instrument-label mb-2">KEY TAKEAWAYS</div>
              <ul className="list-inside list-disc space-y-1 text-sm text-gray-300">
                {lecture.data.key_takeaways.map((k, i) => (
                  <li key={i}>{k}</li>
                ))}
              </ul>
            </div>
          )}
          {lecture.data.quiz_question && (
            <div className="rounded-lg border border-accent-500/40 bg-accent-500/5 p-3 text-sm text-accent-300">
              <span className="instrument-label">COMPREHENSION CHECK</span>
              <p className="mt-1 text-gray-200">{lecture.data.quiz_question}</p>
            </div>
          )}
        </article>
      )}
    </Card>
  );
}

export default function CoursePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params);
  return (
    <RequireAuth>
      <CourseInner courseKey={key} />
    </RequireAuth>
  );
}
