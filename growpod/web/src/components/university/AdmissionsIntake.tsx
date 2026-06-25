"use client";

// Phase 6e — the Admissions intake quiz. Renders the deterministic quiz, submits
// the answers, and shows the recommendation (department / level / course track).
// On success it invalidates the learner + roadmap queries so the rest of the
// dashboard re-derives from the freshly-seeded learner model. NON-economic.

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingBlock } from "@/components/ui/Spinner";
import { useApiMutation } from "@/hooks/useApiMutation";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useSession } from "@/lib/session";
import { titleCase } from "@/lib/format";
import type { AdmissionsResult } from "@/lib/types";

export function AdmissionsIntake() {
  const { playerId } = useSession();
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AdmissionsResult | null>(null);
  const [open, setOpen] = useState(false);

  const quiz = useQuery({
    queryKey: queryKeys.admissionsQuiz(),
    queryFn: () => api.university.admissionsQuiz(),
    staleTime: 5 * 60_000,
  });

  const submit = useApiMutation(
    () => api.university.submitAdmissions(playerId!, answers),
    {
      successMessage: "Your learning path is ready!",
      onSuccess: (data) => {
        setResult(data);
        setOpen(false);
        // Re-derive the rest of the dashboard from the seeded learner model.
        qc.invalidateQueries({ queryKey: queryKeys.learner(playerId ?? "") });
        qc.invalidateQueries({ queryKey: queryKeys.roadmap(playerId ?? "", 7) });
        qc.invalidateQueries({ queryKey: queryKeys.roadmap(playerId ?? "", 14) });
      },
    },
  );

  const questions = quiz.data?.quiz ?? [];
  const allAnswered =
    questions.length > 0 && questions.every((qn) => answers[qn.id]);

  // ---- The recommendation result view ------------------------------------
  if (result) {
    const rec = result.recommendation;
    return (
      <Card className="space-y-3">
        <CardHeader
          title="Your recommended start"
          subtitle="Based on your intake answers."
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setResult(null);
                setOpen(true);
              }}
            >
              Retake
            </Button>
          }
        />
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-grow-700 bg-grow-950/50 px-3 py-1 text-sm text-grow-100">
            🏫 {titleCase(rec.department)}
          </span>
          <span className="rounded-full border border-accent-500/50 bg-accent-500/10 px-3 py-1 text-sm text-accent-300">
            {titleCase(rec.level)}
          </span>
        </div>
        {rec.rationale && <p className="text-sm text-gray-300">{rec.rationale}</p>}
        {rec.track.length > 0 && (
          <div>
            <div className="instrument-label mb-1">SUGGESTED COURSE TRACK</div>
            <ol className="space-y-1">
              {rec.track.map((courseKey, i) => (
                <li
                  key={courseKey}
                  className="flex items-center gap-2 rounded-md border border-ink-600 bg-ink-800 px-3 py-1.5 text-sm text-gray-100"
                >
                  <span className="w-5 tabular-nums text-gray-500">{i + 1}.</span>
                  {titleCase(courseKey)}
                </li>
              ))}
            </ol>
          </div>
        )}
      </Card>
    );
  }

  // ---- The collapsed call-to-action --------------------------------------
  if (!open) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-100">Admissions intake</h2>
          <p className="text-xs text-gray-400">
            Answer a few questions to get a personalized department, level, and study path.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>Take the intake quiz</Button>
      </Card>
    );
  }

  // ---- The quiz form ------------------------------------------------------
  return (
    <Card className="space-y-4">
      <CardHeader
        title="Admissions intake"
        subtitle="Pick the answer that fits you best for each."
        action={
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        }
      />

      {quiz.isLoading ? (
        <LoadingBlock label="Loading the quiz…" />
      ) : quiz.isError || questions.length === 0 ? (
        <p className="text-sm text-gray-400">The intake quiz isn&apos;t available right now.</p>
      ) : (
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (allAnswered && playerId) submit.mutate();
          }}
        >
          {questions.map((qn) => (
            <fieldset key={qn.id} className="space-y-2">
              <legend className="text-sm font-medium text-gray-200">{qn.prompt}</legend>
              <div className="space-y-1.5">
                {qn.choices.map((choice) => {
                  const selected = answers[qn.id] === choice.id;
                  return (
                    <label
                      key={choice.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                        selected
                          ? "border-grow-600 bg-grow-950/50 text-grow-100"
                          : "border-ink-600 bg-ink-800 text-gray-200 hover:border-ink-500"
                      }`}
                    >
                      <input
                        type="radio"
                        name={qn.id}
                        value={choice.id}
                        checked={selected}
                        onChange={() =>
                          setAnswers((a) => ({ ...a, [qn.id]: choice.id }))
                        }
                        className="accent-grow-500"
                      />
                      {choice.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <Button type="submit" loading={submit.isPending} disabled={!allAnswered || !playerId}>
            Get my learning path
          </Button>
        </form>
      )}
    </Card>
  );
}
