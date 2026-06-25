"use client";

// Phase 6e — the Learner Dashboard ("My Path"). Surfaces the Agent Campus: the
// admissions intake, the roadmap, mastery-by-skill, and a risk/streak nudge. All
// NON-economic and behind the `university` feature flag (the API enforces it; this
// page degrades gracefully when the flag is off or an endpoint 404s).

import Link from "next/link";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { FEATURES } from "@/lib/features";
import { AdmissionsIntake } from "@/components/university/AdmissionsIntake";
import { RoadmapPanel } from "@/components/university/RoadmapPanel";
import { MasteryPanel } from "@/components/university/MasteryPanel";
import { RiskNudge } from "@/components/university/RiskNudge";

function LearnerInner() {
  const backLink = (
    <Link href="/university">
      <Button variant="secondary">← Catalog</Button>
    </Link>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="GROWPOD UNIVERSITY · MY PATH"
        title="Learner Dashboard"
        subtitle="Your personalized path through the Agent Campus — intake, a day-by-day roadmap, and your skill mastery. Knowledge only; nothing here costs or earns currency."
        action={backLink}
      />

      {!FEATURES.university ? (
        <EmptyState
          icon="🎓"
          title="Not available yet"
          hint="The Agent Campus learner dashboard isn't enabled in this build. Check back soon."
        />
      ) : (
        <div className="space-y-5">
          <RiskNudge />
          <AdmissionsIntake />
          <RoadmapPanel />
          <MasteryPanel />
        </div>
      )}
    </div>
  );
}

export default function LearnerPage() {
  return (
    <RequireAuth>
      <LearnerInner />
    </RequireAuth>
  );
}
