"use client";

// Phase 4 — Master Grower coach route (university). Behind RequireAuth; the
// university feature flag gates the API. The bot is FREE and read-only.

import Link from "next/link";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { BotChatPanel } from "@/components/university/BotChatPanel";

function CoachInner() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="HERMES UNIVERSITY · COACH"
        title="Master Grower"
        subtitle="Your free, grounded grow coach — it cites the catalog, the strain encyclopedia, and your live plant state, and never guesses."
        action={
          <Link href="/university">
            <Button variant="secondary">← Catalog</Button>
          </Link>
        }
      />

      <div className="h-[70vh]">
        <BotChatPanel />
      </div>
    </div>
  );
}

export default function CoachPage() {
  return (
    <RequireAuth>
      <CoachInner />
    </RequireAuth>
  );
}
