import { describe, expect, it } from "vitest";
import {
  nextLesson,
  groupStepsByDay,
  masteryPercent,
  groupMasteryByDomain,
  riskNudge,
} from "@/lib/university/learnerPath";
import type { RoadmapPlan, RoadmapStep, LearnerProfile } from "@/lib/types";

function step(over: Partial<RoadmapStep>): RoadmapStep {
  return {
    skill_id: "s1",
    name: "Skill One",
    domain: "cultivation",
    day: 1,
    prerequisites: [],
    ...over,
  };
}

function plan(steps: RoadmapStep[]): RoadmapPlan {
  return {
    horizon_days: 7,
    steps,
    skipped_mastered: [],
    rationale: "",
    mastery_by_skill: {},
  };
}

describe("nextLesson", () => {
  it("returns null for an empty / missing plan", () => {
    expect(nextLesson(null)).toBeNull();
    expect(nextLesson(plan([]))).toBeNull();
  });

  it("returns the first step of the earliest day", () => {
    const a = step({ skill_id: "a", day: 2 });
    const b = step({ skill_id: "b", day: 1 });
    const c = step({ skill_id: "c", day: 1 });
    expect(nextLesson(plan([a, b, c]))?.skill_id).toBe("b");
  });
});

describe("groupStepsByDay", () => {
  it("buckets by ascending day and omits empty days", () => {
    const groups = groupStepsByDay(
      plan([
        step({ skill_id: "a", day: 3 }),
        step({ skill_id: "b", day: 1 }),
        step({ skill_id: "c", day: 1 }),
      ]),
    );
    expect(groups.map((g) => g.day)).toEqual([1, 3]);
    expect(groups[0].steps.map((s) => s.skill_id)).toEqual(["b", "c"]);
    expect(groups[1].steps.map((s) => s.skill_id)).toEqual(["a"]);
  });

  it("handles a null plan", () => {
    expect(groupStepsByDay(null)).toEqual([]);
  });
});

describe("masteryPercent", () => {
  it("clamps and rounds 0..1 to an integer percent", () => {
    expect(masteryPercent(0.5)).toBe(50);
    expect(masteryPercent(0.333)).toBe(33);
    expect(masteryPercent(1.5)).toBe(100);
    expect(masteryPercent(-0.2)).toBe(0);
    expect(masteryPercent(null)).toBe(0);
    expect(masteryPercent(undefined)).toBe(0);
    expect(masteryPercent(NaN)).toBe(0);
  });
});

describe("groupMasteryByDomain", () => {
  const steps = [
    { skill_id: "a", name: "Watering", domain: "cultivation" },
    { skill_id: "b", name: "Crossing", domain: "genetics" },
  ];

  it("labels skills from roadmap steps and groups by domain", () => {
    const groups = groupMasteryByDomain({ a: 0.8, b: 0.4 }, steps);
    expect(groups.map((g) => g.domain)).toEqual(["cultivation", "genetics"]);
    expect(groups[0].skills[0].name).toBe("Watering");
    expect(groups[0].skills[0].percent).toBe(80);
  });

  it("falls back to id/general for unknown skills and sorts deterministically", () => {
    const groups = groupMasteryByDomain({ z: 0.2, a: 0.9 }, []);
    expect(groups).toHaveLength(1);
    expect(groups[0].domain).toBe("general");
    // descending mastery
    expect(groups[0].skills.map((s) => s.skill_id)).toEqual(["a", "z"]);
    expect(groups[0].skills[0].name).toBe("a");
  });

  it("handles empty mastery", () => {
    expect(groupMasteryByDomain({}, steps)).toEqual([]);
    expect(groupMasteryByDomain(null)).toEqual([]);
  });
});

describe("riskNudge", () => {
  function prof(over: Partial<LearnerProfile>): LearnerProfile {
    return {
      mastery_by_skill: {},
      misconceptions: {},
      preferred_format: null,
      goals: null,
      experience_level: "beginner",
      risk_level: "none",
      updated_at: null,
      engagement: { kxp: 0, streak_count: 0, freeze_tokens: 0, last_study_date: null },
      ...over,
    };
  }

  it("returns null for a missing profile", () => {
    expect(riskNudge(null)).toBeNull();
  });

  it("warns when at_risk", () => {
    const n = riskNudge(prof({ risk_level: "at_risk" }));
    expect(n?.tone).toBe("warning");
  });

  it("references a slipping streak when at_risk with a streak", () => {
    const n = riskNudge(
      prof({
        risk_level: "at_risk",
        engagement: { kxp: 0, streak_count: 5, freeze_tokens: 0, last_study_date: null },
      }),
    );
    expect(n?.body).toContain("5-day");
  });

  it("is positive otherwise", () => {
    const n = riskNudge(
      prof({
        engagement: { kxp: 0, streak_count: 3, freeze_tokens: 0, last_study_date: null },
      }),
    );
    expect(n?.tone).toBe("positive");
    expect(n?.title).toContain("3-day");
  });
});
