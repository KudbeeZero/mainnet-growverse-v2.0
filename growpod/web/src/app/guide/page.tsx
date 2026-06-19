"use client";

// In-game Grow Guide (Growpedia) — concise, honest, mobile-friendly. Renders the
// data-driven GUIDE_SECTIONS as searchable, collapsible cards with status labels
// so testers can see what's live vs in-progress vs planned. No markdown dump.

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
import { TextInput } from "@/components/ui/Field";
import {
  GUIDE_SECTIONS,
  GUIDE_STATUS_META,
  type GuideSection,
  type GuideStatus,
} from "@/lib/guide/guideContent";
import { APP_VERSION } from "@/lib/version";

function StatusChip({ status }: { status: GuideStatus | "not-wired" }) {
  const meta = (GUIDE_STATUS_META as Record<string, { label: string; cls: string }>)[status] ?? {
    label: "Not wired",
    cls: "border-ink-600 bg-ink-800 text-gray-400",
  };
  return (
    <span className={`ml-2 inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium ${meta.cls}`}>
      {meta.label}
    </span>
  );
}

function matches(section: GuideSection, q: string): boolean {
  if (!q) return true;
  const hay = (
    section.title +
    " " +
    (section.intro ?? "") +
    " " +
    section.items.map((i) => `${i.label ?? ""} ${i.body}`).join(" ")
  ).toLowerCase();
  return hay.includes(q.toLowerCase());
}

export default function GuidePage() {
  const [q, setQ] = useState("");
  const sections = useMemo(() => GUIDE_SECTIONS.filter((s) => matches(s, q)), [q]);

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-grow-200">🌿 Grow Guide</h1>
        <p className="text-sm text-gray-400">
          How to play GrowVerse — and an honest look at what’s live, in progress, or
          coming soon. <span className="text-gray-500">GrowVerse by Kudbee · built on Algorand · v{APP_VERSION}</span>
        </p>
      </div>

      <TextInput
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search the guide…"
        aria-label="Search the guide"
      />

      {sections.length === 0 && (
        <p className="text-sm text-gray-500">No guide entries match “{q}”.</p>
      )}

      {sections.map((section) => (
        <Card key={section.id}>
          <details open={!!q} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-base font-semibold text-gray-100">
                <span aria-hidden>{section.icon}</span>
                {section.title}
              </span>
              <span className="text-gray-500 transition-transform group-open:rotate-90" aria-hidden>
                ▸
              </span>
            </summary>
            {section.intro && <p className="mt-2 text-xs text-gray-400">{section.intro}</p>}
            <ul className="mt-3 space-y-3">
              {section.items.map((item, i) => (
                <li key={i} className="border-l-2 border-ink-600 pl-3">
                  <div className="text-sm text-gray-100">
                    {item.label && <span className="font-medium">{item.label}</span>}
                    {item.status && <StatusChip status={item.status} />}
                  </div>
                  <p className="mt-0.5 text-sm leading-relaxed text-gray-300">{item.body}</p>
                </li>
              ))}
            </ul>
          </details>
        </Card>
      ))}

      <Card>
        <CardHeader title="Grow Board" subtitle="Where build updates will be posted." />
        <p className="text-sm text-gray-300">
          GrowVerse is an early live build by <strong>Kudbee</strong>. We build transparently:
          live systems, placeholders, and upcoming features are labeled clearly across the game.
        </p>
        <p className="mt-2 text-xs text-gray-500">
          <Link href="/dashboard" className="text-grow-300 hover:underline">
            ← Back to your grow
          </Link>
        </p>
      </Card>
    </div>
  );
}
