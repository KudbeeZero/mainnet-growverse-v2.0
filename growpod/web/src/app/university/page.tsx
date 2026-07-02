"use client";

import { useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LoadingBlock } from "@/components/ui/Spinner";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState } from "@/components/ui/States";
import { DepartmentChip, TitleBadge } from "@/components/ui/Pills";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useTranscript } from "@/hooks/queries";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { queryKeys } from "@/lib/queryKeys";
import { grow, hours, titleCase } from "@/lib/format";
import type { TranscriptCourse, TranscriptDegree, CourseStatus } from "@/lib/types";

const STATUS_STYLE: Record<CourseStatus, string> = {
  available: "border-accent-500/50 bg-accent-500/10 text-accent-300",
  locked: "border-ink-600 bg-ink-700 text-gray-500",
  enrolled: "border-amber-600/60 bg-amber-950/40 text-amber-200",
  completed: "border-grow-600 bg-grow-900/60 text-grow-200",
};

function UniversityInner() {
  const transcript = useTranscript();
  const [dept, setDept] = useState<string | "all">("all");

  if (transcript.isLoading) return <LoadingBlock label="Loading the registrar…" />;
  if (transcript.isError || !transcript.data)
    return <ErrorState error={transcript.error} onRetry={() => transcript.refetch()} />;

  const t = transcript.data;
  const departments = Object.entries(t.departments ?? {});
  const courses = dept === "all" ? t.courses : t.courses.filter((c) => c.department === dept);
  const completed = t.courses.filter((c) => c.status === "completed").length;
  // Catalog view: group by department ("schools") like a real course catalog.
  const sections =
    dept === "all"
      ? departments
          .map(([key, label]) => [key, label, t.courses.filter((c) => c.department === key)] as const)
          .filter(([, , list]) => list.length > 0)
      : null;
  const unassigned = dept === "all" ? t.courses.filter((c) => !c.department || !(c.department in (t.departments ?? {}))) : [];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="HERMES UNIVERSITY · CANNABIS SCIENCES"
        title="Course Catalog"
        subtitle="Earn real degrees: enroll, study real time, pass a practical tied to your live grow, and claim permanent perks + a title."
        action={
          <div className="flex gap-2">
            <Link href="/university/learner">
              <Button variant="secondary">🧭 My Path</Button>
            </Link>
            <Link href="/university/coach">
              <Button variant="secondary">🌱 Coach</Button>
            </Link>
            <Link href="/university/explorer">
              <Button variant="secondary">🔬 Explorer</Button>
            </Link>
            <Link href="/university/transcript">
              <Button variant="secondary">📜 Transcript</Button>
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {t.title && <TitleBadge>{t.title}</TitleBadge>}
        <span className="instrument-label ml-1">
          {completed}/{t.courses.length} COURSES COMPLETE · {t.degrees.filter((d) => d.earned).length} DEGREES
        </span>
      </div>

      {t.degrees.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {t.degrees.map((d) => (
            <DegreeProgress key={d.key} degree={d} />
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <DepartmentChip label="All" active={dept === "all"} onClick={() => setDept("all")} />
        {departments.map(([key, label]) => (
          <DepartmentChip key={key} label={label} active={dept === key} onClick={() => setDept(key)} />
        ))}
      </div>

      {sections ? (
        <div className="space-y-6">
          {sections.map(([key, label, list]) => (
            <section key={key}>
              <div className="mb-2 flex items-baseline gap-2 border-b border-ink-700 pb-1.5">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-200">
                  School of {label}
                </h2>
                <span className="instrument-label">
                  {list.filter((c) => c.status === "completed").length}/{list.length} COMPLETE
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((c) => (
                  <CourseCard key={c.key} course={c} deptLabel={label} />
                ))}
              </div>
            </section>
          ))}
          {unassigned.length > 0 && (
            <section>
              <div className="mb-2 border-b border-ink-700 pb-1.5">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-200">Electives</h2>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {unassigned.map((c) => (
                  <CourseCard key={c.key} course={c} deptLabel={c.department ?? ""} />
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <CourseCard key={c.key} course={c} deptLabel={t.departments?.[c.department ?? ""] ?? c.department ?? ""} />
          ))}
        </div>
      )}
    </div>
  );
}

function DegreeProgress({ degree }: { degree: TranscriptDegree }) {
  const done = degree.completed_required.length;
  const total = degree.required_courses.length || 1;
  const pct = Math.round((Math.min(done, total) / total) * 100);
  return (
    <Link href="/university/transcript" className="block">
      <div
        className={`rounded-lg border px-3 py-2 transition-colors hover:border-grow-500/60 ${
          degree.earned ? "border-grow-600 bg-grow-900/40" : "border-ink-700 bg-ink-900/50"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-semibold text-gray-200">{degree.name}</span>
          {degree.earned ? (
            <span className="text-xs text-grow-300">🎓 Earned</span>
          ) : degree.claimable ? (
            <span className="text-xs text-amber-300">Claimable</span>
          ) : (
            <span className="instrument-label">{done}/{total}</span>
          )}
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-ink-700">
          <div
            className={`h-full rounded-full ${degree.earned ? "bg-grow-500" : "bg-accent-500"}`}
            style={{ width: `${degree.earned ? 100 : pct}%` }}
          />
        </div>
      </div>
    </Link>
  );
}

function CourseCard({ course, deptLabel }: { course: TranscriptCourse; deptLabel: string }) {
  const { playerId } = useSession();
  const enroll = useApiMutation(() => api.university.enroll(playerId!, course.key), {
    invalidate: [queryKeys.transcript(playerId ?? ""), queryKeys.wallet(playerId ?? "")],
    successMessage: `Enrolled in ${course.name}`,
  });

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Link href={`/university/courses/${course.key}`} className="font-semibold text-gray-100 hover:text-grow-300">
            {course.name}
          </Link>
          <div className="instrument-label mt-0.5">{deptLabel}</div>
        </div>
        <Badge className={STATUS_STYLE[course.status]}>{titleCase(course.status)}</Badge>
      </div>

      <div className="grid grid-cols-4 gap-2 text-xs text-gray-400">
        <span>Lv {course.level_req}</span>
        <span>{hours(course.duration_hours)}</span>
        <span>{course.credits != null ? `${course.credits} cr` : "—"}</span>
        <span>{grow(course.tuition)}</span>
      </div>

      {course.status === "enrolled" && course.progress && (
        <div className="rounded-md border border-ink-700 bg-ink-900/50 px-2.5 py-1.5 text-xs text-gray-400">
          {course.progress.study_hours_remaining > 0
            ? `${hours(course.progress.study_hours_remaining)} of study left`
            : "Study complete"}{" "}
          · practical {course.progress.practical_met ? "✓" : "✗"}
        </div>
      )}

      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        {course.status === "available" && (
          <Button size="sm" loading={enroll.isPending} onClick={() => enroll.mutate()}>
            Enroll · {grow(course.tuition)}
          </Button>
        )}
        <Link href={`/university/courses/${course.key}`}>
          <Button size="sm" variant="secondary">
            {course.lecture_topic ? "Open · Lecture" : "Open"}
          </Button>
        </Link>
      </div>
    </Card>
  );
}

export default function UniversityPage() {
  return (
    <RequireAuth>
      <UniversityInner />
    </RequireAuth>
  );
}
