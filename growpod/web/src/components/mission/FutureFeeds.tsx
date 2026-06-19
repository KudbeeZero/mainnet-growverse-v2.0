"use client";

// Honest "what's coming, and why it isn't here yet" section. Planning only — no
// pipeline is implemented. Keeps the board from pretending PR/deploy are live.

import { Card, CardHeader } from "@/components/ui/Card";

const ITEMS: { title: string; body: string }[] = [
  {
    title: "GitHub PR / review feed",
    body: "Needs a server-side route (e.g. /api/ops/pr) calling the GitHub API with a server-only token — never a NEXT_PUBLIC secret. Cached + rate-limited; preview vs production separated.",
  },
  {
    title: "Deploy / CI status",
    body: "A server-side adapter polling the deploy provider, or a webhook into a small server store. Surfaced as status cards once the secret-handling + caching are in place.",
  },
  {
    title: "Visibility rules",
    body: "Repo internals stay owner/admin-only; a sanitized public version comes later. No private branch/PR data is exposed to players.",
  },
  {
    title: "Environment history + CO₂",
    body: "EnvironmentReading rows exist but have no API route yet; CO₂ isn't in the sim. Both need backend work before the board can chart them.",
  },
];

export function FutureFeeds() {
  return (
    <Card>
      <CardHeader
        title="Future Feeds (planned — not built)"
        subtitle="What this board will add next, and the work each needs. None of it is wired today."
      />
      <ul className="space-y-3">
        {ITEMS.map((it) => (
          <li key={it.title} className="rounded-lg border border-ink-700 bg-ink-900/40 p-3">
            <div className="text-sm font-medium text-gray-200">{it.title}</div>
            <p className="mt-0.5 text-xs text-gray-500">{it.body}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
