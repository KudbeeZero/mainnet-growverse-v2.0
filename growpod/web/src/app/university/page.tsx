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
import type { TranscriptCourse, CourseStatus } from "@/lib/types";

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

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="GROWPOD UNIVERSITY"
        title="Course Catalog"
        subtitle="Earn real degrees: enroll, study real time, pass a practical tied to your live grow, and claim permanent perks + a title."
        action={
          <Link href="/university/transcript">
            <Button variant="secondary">📜 Transcript</Button>
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {t.title && <TitleBadge>{t.title}</TitleBadge>}
        <span className="instrument-label ml-1">
          {completed}/{t.courses.length} COURSES COMPLETE · {t.degrees.filter((d) => d.earned).length} DEGREES
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <DepartmentChip label="All" active={dept === "all"} onClick={() => setDept("all")} />
        {departments.map(([key, label]) => (
          <DepartmentChip key={key} label={label} active={dept === key} onClick={() => setDept(key)} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((c) => (
          <CourseCard key={c.key} course={c} deptLabel={t.departments?.[c.department ?? ""] ?? c.department ?? ""} />
        ))}
      </div>
    </div>
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

      <div className="grid grid-cols-3 gap-2 text-xs text-gray-400">
        <span>Lv {course.level_req}</span>
        <span>{hours(course.duration_hours)}</span>
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
