import { apiFetch } from "./client";
import type {
  UniversityCatalog,
  Transcript,
  Enrollment,
  LectureReport,
  PresenterVideo,
  MasterGrowerReport,
  UniversityProgress,
  Scholar,
  Exam,
  ExamSubmission,
  ExamResponse,
  LearnerProfile,
  RoadmapPlan,
  AdmissionsQuiz,
  AdmissionsResult,
} from "@/lib/types";

export const university = {
  catalog: () => apiFetch<UniversityCatalog>(`/university/catalog`),

  transcript: (playerId: string) =>
    apiFetch<Transcript>(`/players/${playerId}/university`, { auth: true }),

  enroll: (playerId: string, courseKey: string) =>
    apiFetch<Enrollment>(`/players/${playerId}/courses/${courseKey}/enroll`, {
      method: "POST",
    }),

  complete: (playerId: string, courseKey: string) =>
    apiFetch<Record<string, unknown>>(
      `/players/${playerId}/courses/${courseKey}/complete`,
      { method: "POST" },
    ),

  claimDegree: (playerId: string, degreeKey: string) =>
    apiFetch<Record<string, unknown>>(
      `/players/${playerId}/degrees/${degreeKey}/claim`,
      { method: "POST" },
    ),

  // AI Professor lecture (GET but player-scoped → needs the key).
  lecture: (
    playerId: string,
    courseKey: string,
    opts: { level?: string; plant_id?: string } = {},
  ) =>
    apiFetch<LectureReport>(`/players/${playerId}/courses/${courseKey}/lecture`, {
      auth: true,
      query: opts,
    }),

  // Professor presenter video (deterministic mock until HeyGen is enabled). Public read.
  presenterVideo: (courseKey: string) =>
    apiFetch<PresenterVideo>(`/university/courses/${courseKey}/presenter-video`),

  // Ask the FREE Master Grower bot a grounded question (player-scoped, authed).
  askMasterGrower: (playerId: string, question: string, plantId?: string) =>
    apiFetch<MasterGrowerReport>(`/players/${playerId}/master-grower/ask`, {
      method: "POST",
      auth: true,
      body: { question, ...(plantId ? { plant_id: plantId } : {}) },
    }),

  // Non-economic engagement: KXP / streak / freeze tokens + a proactive nudge.
  progress: (playerId: string) =>
    apiFetch<UniversityProgress>(`/players/${playerId}/university/progress`, { auth: true }),

  // The KXP "Scholars" league (public read).
  scholars: (limit = 10) =>
    apiFetch<Scholar[]>(`/leaderboards/scholars`, { query: { limit } }),

  // An exam's questions — client-safe (answer keys stripped server-side). Public read.
  exam: (courseKey: string, examId: string) =>
    apiFetch<Exam>(`/university/courses/${courseKey}/exams/${examId}`),

  // Submit exam responses for server-side grading; persists the best attempt.
  submitExam: (
    playerId: string,
    courseKey: string,
    examId: string,
    responses: Record<string, ExamResponse>,
  ) =>
    apiFetch<ExamSubmission>(
      `/players/${playerId}/courses/${courseKey}/exams/${examId}/submit`,
      { method: "POST", body: { responses } },
    ),

  // ---- Agent Campus (Phase 6): learner model, roadmap, admissions intake ----

  // The centralized NON-economic learner read model (mastery / prefs / risk +
  // engagement slice). Player-scoped, authed.
  learner: (playerId: string) =>
    apiFetch<LearnerProfile>(`/players/${playerId}/university/learner`, {
      auth: true,
    }),

  // The ordered, prerequisite-respecting study path. horizon is 7 or 14 days.
  roadmap: (playerId: string, horizon: 7 | 14 = 7) =>
    apiFetch<RoadmapPlan>(`/players/${playerId}/university/roadmap`, {
      auth: true,
      query: { horizon },
    }),

  // The Admissions intake quiz definition (public read, like the catalog).
  admissionsQuiz: () =>
    apiFetch<AdmissionsQuiz>(`/university/admissions/quiz`),

  // Run the intake quiz: seeds the learner model and returns the recommendation
  // + the merged profile. Body is {answers: {question_id: choice_id}}.
  submitAdmissions: (playerId: string, answers: Record<string, string>) =>
    apiFetch<AdmissionsResult>(`/players/${playerId}/university/admissions`, {
      method: "POST",
      body: { answers },
    }),
};
