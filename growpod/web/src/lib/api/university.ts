import { apiFetch } from "./client";
import type {
  UniversityCatalog,
  Transcript,
  Enrollment,
  LectureReport,
  Exam,
  ExamSubmission,
  ExamResponse,
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
};
