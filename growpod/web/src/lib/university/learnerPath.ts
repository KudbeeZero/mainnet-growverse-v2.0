// Pure, deterministic selectors over the Agent Campus read models (roadmap /
// learner / mastery). No React, no I/O — unit-tested in learnerPath.test.ts so
// the dashboard's display logic stays honest regardless of rendering.

import type { LearnerProfile, RoadmapPlan, RoadmapStep } from "@/lib/types";

/** The single "Next lesson" — the first step of the earliest scheduled day, or
 *  null when the path has no steps (nothing left to study / no roadmap yet). */
export function nextLesson(plan: RoadmapPlan | null | undefined): RoadmapStep | null {
  const steps = plan?.steps ?? [];
  if (steps.length === 0) return null;
  // Steps are already emitted in path order, but be defensive about ordering:
  // pick the lowest day, then preserve the in-array order within that day.
  let best = steps[0];
  for (const step of steps) {
    if (step.day < best.day) best = step;
  }
  return steps.find((s) => s.day === best.day) ?? best;
}

/** Group roadmap steps into ascending-day buckets: [{ day, steps }]. Days with
 *  no steps are omitted; within a day the original path order is preserved. */
export function groupStepsByDay(
  plan: RoadmapPlan | null | undefined,
): Array<{ day: number; steps: RoadmapStep[] }> {
  const byDay = new Map<number, RoadmapStep[]>();
  for (const step of plan?.steps ?? []) {
    const bucket = byDay.get(step.day);
    if (bucket) bucket.push(step);
    else byDay.set(step.day, [step]);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([day, steps]) => ({ day, steps }));
}

/** A 0..1 mastery score as an integer percent (clamped, rounded). */
export function masteryPercent(score: number | null | undefined): number {
  if (score === null || score === undefined || Number.isNaN(score)) return 0;
  return Math.round(Math.max(0, Math.min(1, score)) * 100);
}

export interface MasterySkill {
  skill_id: string;
  /** Human label — falls back to the skill_id when no name is known. */
  name: string;
  domain: string;
  score: number;
  percent: number;
}

/**
 * Build labeled, domain-grouped mastery rows from the learner's
 * `mastery_by_skill`, enriching each skill with a name/domain looked up from the
 * roadmap steps (the only place the web client learns skill names). Skills with
 * no known name still appear (labeled by id, domain "general"). Sorted: domains
 * alphabetically, skills by descending mastery then id — deterministic.
 */
export function groupMasteryByDomain(
  masteryBySkill: Record<string, number> | null | undefined,
  steps: ReadonlyArray<Pick<RoadmapStep, "skill_id" | "name" | "domain">> = [],
): Array<{ domain: string; skills: MasterySkill[] }> {
  const meta = new Map<string, { name: string; domain: string }>();
  for (const s of steps) {
    meta.set(s.skill_id, { name: s.name || s.skill_id, domain: s.domain || "general" });
  }

  const rows: MasterySkill[] = Object.entries(masteryBySkill ?? {}).map(
    ([skillId, score]) => {
      const m = meta.get(skillId);
      return {
        skill_id: skillId,
        name: m?.name ?? skillId,
        domain: m?.domain ?? "general",
        score,
        percent: masteryPercent(score),
      };
    },
  );

  const byDomain = new Map<string, MasterySkill[]>();
  for (const row of rows) {
    const bucket = byDomain.get(row.domain);
    if (bucket) bucket.push(row);
    else byDomain.set(row.domain, [row]);
  }

  return [...byDomain.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([domain, skills]) => ({
      domain,
      skills: skills.sort(
        (a, b) => b.score - a.score || a.skill_id.localeCompare(b.skill_id),
      ),
    }));
}

export interface RiskNudgeMessage {
  tone: "warning" | "positive";
  title: string;
  body: string;
}

/**
 * Turn the learner's `risk_level` (+ streak) into a small, encouraging nudge.
 * `at_risk` → a gentle prompt to study; otherwise a positive streak note.
 * Pure: never references economy/GROW. Returns null only for a null profile.
 */
export function riskNudge(
  profile: Pick<LearnerProfile, "risk_level" | "engagement"> | null | undefined,
): RiskNudgeMessage | null {
  if (!profile) return null;
  const streak = profile.engagement?.streak_count ?? 0;

  if (profile.risk_level === "at_risk") {
    return {
      tone: "warning",
      title: "Let's get back on track",
      body:
        streak > 0
          ? `Your ${streak}-day streak is slipping. A short study session today keeps it alive.`
          : "It's been a while — a quick lesson now will rebuild your momentum.",
    };
  }

  return {
    tone: "positive",
    title: streak > 0 ? `${streak}-day study streak` : "You're on track",
    body:
      streak > 0
        ? "Nice cadence — keep it going with your next lesson below."
        : "Knock out your next lesson to start a study streak.",
  };
}
