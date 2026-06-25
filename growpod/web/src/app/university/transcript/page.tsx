"use client";

import Link from "next/link";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LoadingBlock } from "@/components/ui/Spinner";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState } from "@/components/ui/States";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { TitleBadge } from "@/components/ui/Pills";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useTranscript } from "@/hooks/queries";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { queryKeys } from "@/lib/queryKeys";
import { titleCase } from "@/lib/format";
import { StudyProgressCard, ScholarsLeagueCard } from "@/components/university/EngagementPanel";
import type { TranscriptDegree } from "@/lib/types";

function TranscriptInner() {
  const transcript = useTranscript();

  if (transcript.isLoading) return <LoadingBlock label="Pulling your transcript…" />;
  if (transcript.isError || !transcript.data)
    return <ErrorState error={transcript.error} onRetry={() => transcript.refetch()} />;

  const t = transcript.data;
  const completedCourses = t.courses.filter((c) => c.status === "completed");

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="REGISTRAR"
        title="Transcript"
        subtitle="Your degree progress, prestige title, and completed coursework."
        action={
          <Link href="/university">
            <Button variant="secondary">← Catalog</Button>
          </Link>
        }
      />

      {t.title && (
        <Card className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden>🎓</span>
          <div>
            <div className="instrument-label">CONFERRED TITLE</div>
            <TitleBadge>{t.title}</TitleBadge>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <StudyProgressCard />
        <ScholarsLeagueCard />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-300">Degrees</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {t.degrees.map((d) => (
            <DegreeCard key={d.key} degree={d} />
          ))}
        </div>
      </div>

      <Card>
        <CardHeader title="Completed coursework" subtitle={`${completedCourses.length} courses passed`} />
        {completedCourses.length === 0 ? (
          <p className="text-sm text-gray-500">No courses completed yet.</p>
        ) : (
          <ul className="divide-y divide-ink-700 text-sm">
            {completedCourses.map((c) => (
              <li key={c.key} className="flex items-center justify-between py-2">
                <Link href={`/university/courses/${c.key}`} className="text-gray-200 hover:text-grow-300">
                  {c.name}
                </Link>
                <span className="instrument-label">{t.departments?.[c.department ?? ""] ?? c.department}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function DegreeCard({ degree }: { degree: TranscriptDegree }) {
  const { playerId } = useSession();
  const required = degree.required_courses.length || 1;
  const done = degree.completed_required.length;
  const pct = (done / required) * 100;

  const claim = useApiMutation(() => api.university.claimDegree(playerId!, degree.key), {
    invalidate: [queryKeys.transcript(playerId ?? ""), queryKeys.player(playerId ?? "")],
    successMessage: `Degree conferred: ${degree.name}`,
  });

  return (
    <Card className="flex items-center gap-4">
      <ProgressRing pct={degree.earned ? 100 : pct} color={degree.earned ? "#fbbf24" : "#76c024"}>
        <span className="instrument-value text-xs text-gray-200">
          {done}/{degree.required_courses.length}
        </span>
      </ProgressRing>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-100">{degree.name}</span>
          {degree.tier && <Badge className="border-ink-600 bg-ink-700 text-gray-400">{titleCase(degree.tier)}</Badge>}
        </div>
        {degree.title && <div className="text-xs text-amber-300">Title: {degree.title}</div>}
        <div className="mt-2">
          {degree.earned ? (
            <Badge className="border-grow-600 bg-grow-900/60 text-grow-200">✓ Earned</Badge>
          ) : degree.claimable ? (
            <Button size="sm" loading={claim.isPending} onClick={() => claim.mutate()}>
              Claim degree
            </Button>
          ) : (
            <span className="text-xs text-gray-500">Finish required courses to claim.</span>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function TranscriptPage() {
  return (
    <RequireAuth>
      <TranscriptInner />
    </RequireAuth>
  );
}
