"use client";

// Phase 6e — mastery-by-skill as labeled progress bars, grouped by domain. Skill
// names/domains are sourced from the roadmap steps (the only place the web client
// learns them); unlabeled skills still appear under "general".

import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader } from "@/components/ui/Card";
import { LoadingBlock } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/States";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useSession } from "@/lib/session";
import { titleCase } from "@/lib/format";
import { groupMasteryByDomain } from "@/lib/university/learnerPath";
import type { MasterySkill } from "@/lib/university/learnerPath";

function MasteryBar({ skill }: { skill: MasterySkill }) {
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between text-sm">
        <span className="text-gray-200">{titleCase(skill.name)}</span>
        <span className="tabular-nums text-gray-400">{skill.percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-ink-700">
        <div
          className="h-full rounded-full bg-grow-500"
          style={{ width: `${skill.percent}%` }}
        />
      </div>
    </div>
  );
}

export function MasteryPanel() {
  const { playerId } = useSession();

  const learner = useQuery({
    queryKey: queryKeys.learner(playerId ?? ""),
    queryFn: () => api.university.learner(playerId!),
    enabled: !!playerId,
    staleTime: 30_000,
  });

  // Roadmap steps carry the skill names/domains used to label the bars. The
  // 14-day horizon covers the most skills, so it's the richest label source.
  const roadmap = useQuery({
    queryKey: queryKeys.roadmap(playerId ?? "", 14),
    queryFn: () => api.university.roadmap(playerId!, 14),
    enabled: !!playerId,
    staleTime: 30_000,
  });

  if (learner.isLoading) {
    return (
      <Card>
        <LoadingBlock label="Loading your mastery…" />
      </Card>
    );
  }

  if (learner.isError || !learner.data) {
    return (
      <Card>
        <CardHeader title="Skill mastery" />
        <EmptyState icon="📊" title="No mastery data yet" hint="Study a few lessons to start tracking your skills." />
      </Card>
    );
  }

  const groups = groupMasteryByDomain(
    learner.data.mastery_by_skill,
    roadmap.data?.steps ?? [],
  );

  return (
    <Card className="space-y-4">
      <CardHeader title="Skill mastery" subtitle="Your progress across each domain." />
      {groups.length === 0 ? (
        <EmptyState
          icon="📊"
          title="No mastery data yet"
          hint="Study a few lessons to start tracking your skills."
        />
      ) : (
        groups.map(({ domain, skills }) => (
          <div key={domain} className="space-y-2">
            <div className="instrument-label">{titleCase(domain)}</div>
            <div className="space-y-2.5">
              {skills.map((s) => (
                <MasteryBar key={s.skill_id} skill={s} />
              ))}
            </div>
          </div>
        ))
      )}
    </Card>
  );
}
