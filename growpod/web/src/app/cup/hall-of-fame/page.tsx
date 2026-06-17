"use client";

import Link from "next/link";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingBlock } from "@/components/ui/Spinner";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { TitleBadge } from "@/components/ui/Pills";
import { useHallOfFame } from "@/hooks/queries";
import { titleCase, dateTime } from "@/lib/format";

function HallOfFameInner() {
  const hof = useHallOfFame();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="LIFETIME RECORD"
        title="Hall of Fame"
        subtitle="Every season's champion and their one-of-a-kind trophy strain."
        action={
          <Link href="/cup">
            <Button variant="secondary">← Current Cup</Button>
          </Link>
        }
      />

      {hof.isLoading ? (
        <LoadingBlock />
      ) : hof.isError ? (
        <ErrorState error={hof.error} onRetry={() => hof.refetch()} />
      ) : (hof.data ?? []).length === 0 ? (
        <EmptyState icon="♛" title="No champions yet" hint="The first Cup is still waiting for its winner." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(hof.data ?? []).map((e, i) => (
            <Card key={`${e.edition}-${i}`} className="canvas-dark">
              <div className="instrument-label mb-1">
                {e.edition} · {titleCase(e.season ?? "")}
              </div>
              <div className="text-lg font-bold text-gray-50">{e.title}</div>
              <div className="mt-2 flex items-center gap-2">
                <TitleBadge>{e.winner ?? "Unknown grower"}</TitleBadge>
              </div>
              {e.champion_strain && (
                <div className="mt-2 text-sm text-gray-300">
                  Trophy strain:{" "}
                  {e.champion_strain_id ? (
                    <Link href={`/lab/strains/${e.champion_strain_id}`} className="text-grow-300 hover:underline">
                      {e.champion_strain}
                    </Link>
                  ) : (
                    e.champion_strain
                  )}
                </div>
              )}
              <div className="mt-1 text-xs text-gray-500">Judged {dateTime(e.judged_at)}</div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HallOfFamePage() {
  return (
    <RequireAuth>
      <HallOfFameInner />
    </RequireAuth>
  );
}
