"use client";

import { useState } from "react";
import { useQuery, type QueryKey } from "@tanstack/react-query";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LoadingBlock } from "@/components/ui/Spinner";
import { useApiMutation } from "@/hooks/useApiMutation";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import type {
  CourseExamState,
  ExamItem,
  ExamResponse,
  ExamResultItem,
} from "@/lib/types";

const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * Knowledge-check / exam section for a course. Lists the course's exams (state
 * from the transcript) and lets the player take one — fetching the client-safe
 * questions, answering all five item types, submitting for server-side grading,
 * and seeing instant per-item feedback. Behind the university feature flag via
 * the page's RequireAuth + RequireFeature.
 */
export function ExamSection({
  courseKey,
  exams,
  requiresExam,
  invalidate,
}: {
  courseKey: string;
  exams: CourseExamState[];
  requiresExam: string | null;
  invalidate: QueryKey[];
}) {
  const [openExam, setOpenExam] = useState<string | null>(null);

  if (!exams || exams.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title="Knowledge checks"
        subtitle="Pass the mastery exam to certify the course."
      />
      <div className="space-y-2">
        {exams.map((ex) => {
          const required = requiresExam === ex.exam_id;
          return (
            <div
              key={ex.exam_id}
              className="rounded-lg border border-ink-700 bg-ink-900/50 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-100">{ex.title}</span>
                    {ex.passed ? (
                      <Badge className="border-grow-600 bg-grow-900/60 text-grow-200">✓ Passed</Badge>
                    ) : required ? (
                      <Badge className="border-accent-500/40 bg-accent-500/10 text-accent-300">Required</Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Pass mark {pct(ex.pass)}
                    {ex.attempts > 0 && ` · best ${pct(ex.best_score)} · ${ex.attempts} attempt${ex.attempts === 1 ? "" : "s"}`}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={ex.passed ? "secondary" : "primary"}
                  onClick={() => setOpenExam(openExam === ex.exam_id ? null : ex.exam_id)}
                >
                  {openExam === ex.exam_id ? "Close" : ex.passed ? "Review" : ex.attempts > 0 ? "Retry" : "Start"}
                </Button>
              </div>

              {openExam === ex.exam_id && (
                <ExamRunner
                  courseKey={courseKey}
                  examId={ex.exam_id}
                  invalidate={invalidate}
                />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ExamRunner({
  courseKey,
  examId,
  invalidate,
}: {
  courseKey: string;
  examId: string;
  invalidate: QueryKey[];
}) {
  const { playerId } = useSession();
  const [responses, setResponses] = useState<Record<string, ExamResponse>>({});

  const exam = useQuery({
    queryKey: ["exam", courseKey, examId],
    queryFn: () => api.university.exam(courseKey, examId),
    staleTime: 5 * 60_000,
  });

  const submit = useApiMutation(
    () => api.university.submitExam(playerId!, courseKey, examId, responses),
    {
      invalidate,
      successMessage: (data) =>
        data.result.passed ? `Passed — ${data.result.percent}%` : `Scored ${data.result.percent}%`,
    },
  );

  const feedback = submit.data?.result.items.reduce<Record<string, ExamResultItem>>(
    (acc, it) => ((acc[it.id] = it), acc),
    {},
  );

  function setResponse(id: string, value: ExamResponse) {
    if (submit.data) return; // locked after grading; retry clears it
    setResponses((r) => ({ ...r, [id]: value }));
  }

  function retry() {
    submit.reset();
    setResponses({});
  }

  if (exam.isLoading) return <LoadingBlock label="Loading exam…" />;
  if (exam.isError || !exam.data)
    return <p className="mt-3 text-sm text-red-300">Couldn&apos;t load this exam.</p>;

  const result = submit.data?.result;

  return (
    <div className="mt-3 space-y-4 border-t border-ink-700 pt-3">
      {result && (
        <div
          className={`flex items-center justify-between rounded-lg border p-3 ${
            result.passed
              ? "border-grow-600 bg-grow-900/40 text-grow-200"
              : "border-amber-600/50 bg-amber-900/20 text-amber-200"
          }`}
        >
          <span className="font-semibold">
            {result.passed ? "✓ Passed" : "Not yet"} — {result.percent}%
          </span>
          <span className="text-xs opacity-80">
            {result.correct_count}/{result.total} correct · need {pct(result.pass_threshold)}
          </span>
        </div>
      )}

      <ol className="space-y-4">
        {exam.data.items.map((item, i) => (
          <li key={item.id}>
            <ItemBlock
              item={item}
              index={i}
              value={responses[item.id]}
              onChange={(v) => setResponse(item.id, v)}
              feedback={feedback?.[item.id]}
            />
          </li>
        ))}
      </ol>

      <div className="flex items-center gap-2">
        {!result ? (
          <Button loading={submit.isPending} onClick={() => submit.mutate()}>
            Submit answers
          </Button>
        ) : (
          <Button variant="secondary" onClick={retry}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}

function ItemBlock({
  item,
  index,
  value,
  onChange,
  feedback,
}: {
  item: ExamItem;
  index: number;
  value: ExamResponse | undefined;
  onChange: (v: ExamResponse) => void;
  feedback?: ExamResultItem;
}) {
  const border =
    feedback === undefined
      ? "border-ink-700"
      : feedback.correct
        ? "border-grow-600/60"
        : "border-red-600/60";

  return (
    <div className={`rounded-lg border ${border} bg-ink-900/30 p-3`}>
      <div className="mb-2 flex items-start gap-2">
        <span className="instrument-label mt-0.5">Q{index + 1}</span>
        <p className="text-sm text-gray-200">{item.stem}</p>
        {feedback !== undefined && (
          <span className="ml-auto text-sm">{feedback.correct ? "✅" : "❌"}</span>
        )}
      </div>

      <ItemInput item={item} value={value} onChange={onChange} locked={feedback !== undefined} />

      {feedback?.explain && (
        <p className="mt-2 rounded-md bg-ink-800/60 px-2.5 py-1.5 text-xs leading-relaxed text-gray-400">
          {feedback.explain}
        </p>
      )}
    </div>
  );
}

function ItemInput({
  item,
  value,
  onChange,
  locked,
}: {
  item: ExamItem;
  value: ExamResponse | undefined;
  onChange: (v: ExamResponse) => void;
  locked: boolean;
}) {
  const base =
    "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm cursor-pointer transition-colors";
  const pick = (active: boolean) =>
    active
      ? "border-grow-500 bg-grow-900/40 text-grow-100"
      : "border-ink-600 bg-ink-800 text-gray-300 hover:border-grow-700";

  switch (item.type) {
    case "mcq":
      return (
        <div className="space-y-1.5">
          {(item.choices ?? []).map((c, i) => (
            <label key={i} className={`${base} ${pick(value === i)} ${locked ? "cursor-default" : ""}`}>
              <input
                type="radio"
                name={item.id}
                className="accent-grow-500"
                checked={value === i}
                disabled={locked}
                onChange={() => onChange(i)}
              />
              <span>{c}</span>
            </label>
          ))}
        </div>
      );

    case "multi": {
      const arr = Array.isArray(value) ? (value as number[]) : [];
      const toggle = (i: number) =>
        onChange(arr.includes(i) ? arr.filter((x) => x !== i) : [...arr, i]);
      return (
        <div className="space-y-1.5">
          {(item.choices ?? []).map((c, i) => (
            <label key={i} className={`${base} ${pick(arr.includes(i))} ${locked ? "cursor-default" : ""}`}>
              <input
                type="checkbox"
                className="accent-grow-500"
                checked={arr.includes(i)}
                disabled={locked}
                onChange={() => toggle(i)}
              />
              <span>{c}</span>
            </label>
          ))}
        </div>
      );
    }

    case "tf":
      return (
        <div className="flex gap-2">
          {[true, false].map((b) => (
            <button
              key={String(b)}
              type="button"
              disabled={locked}
              onClick={() => onChange(b)}
              className={`${base} ${pick(value === b)} ${locked ? "cursor-default" : ""}`}
            >
              {b ? "True" : "False"}
            </button>
          ))}
        </div>
      );

    case "numeric":
      return (
        <input
          type="number"
          inputMode="decimal"
          disabled={locked}
          value={typeof value === "number" ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
          className="w-40 rounded-md border border-ink-600 bg-ink-900 px-2.5 py-1.5 text-sm text-gray-100"
          placeholder="Your answer"
        />
      );

    case "drag_sort": {
      const pairing = (value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, string>)
        : {}) as Record<string, string>;
      return (
        <div className="space-y-2">
          {(item.prompt_keys ?? []).map((k) => (
            <div key={k} className="flex items-center gap-2">
              <span className="w-32 shrink-0 text-sm font-medium text-gray-200">{k}</span>
              <span className="text-gray-600">→</span>
              <select
                disabled={locked}
                value={pairing[k] ?? ""}
                onChange={(e) => onChange({ ...pairing, [k]: e.target.value })}
                aria-label={`Match for ${k}`}
                className="flex-1 rounded-md border border-ink-600 bg-ink-900 px-2 py-1.5 text-sm text-gray-200"
              >
                <option value="">Choose…</option>
                {(item.options ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      );
    }

    default:
      return null;
  }
}
