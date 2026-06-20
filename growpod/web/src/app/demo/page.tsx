"use client";

// Local Demo Mode page (public route — no backend login required). Lets the
// owner reach the playable grow loop offline while cloud login is finalized.
// All state is local (localStorage); honest wording makes clear nothing syncs.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { PlantVisual } from "@/components/plant/PlantVisual";
import {
  loadDemo,
  startDemo,
  resetDemo,
  saveDemo,
  waterPlant,
  feedPlant,
  toggleLight,
  advanceDay,
  demoFlags,
  STAGE_LABEL,
  DEMO_STRAINS,
  type DemoGrow,
} from "@/lib/demoStore";

function Banner() {
  return (
    <div className="mb-4 rounded-md border border-amber-700/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-100">
      <strong>Local Demo Mode</strong> — cloud sync is not connected yet. Your grow is
      saved locally on this device.
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-ink-600 bg-ink-900 px-3 py-2">
      <div className="text-gray-400">{label}</div>
      <div className="text-sm text-gray-100">{value}</div>
    </div>
  );
}

export default function DemoPage() {
  const [grow, setGrow] = useState<DemoGrow | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [name, setName] = useState("");
  const [showStats, setShowStats] = useState(true);
  const [savedAt, setSavedAt] = useState(false);

  // localStorage is client-only — read after mount to avoid hydration mismatch.
  useEffect(() => {
    setGrow(loadDemo());
    setHydrated(true);
  }, []);

  if (!hydrated) return null;

  if (!grow) {
    return (
      <div className="mx-auto max-w-lg p-4">
        <Banner />
        <Card>
          <CardHeader
            title="Pick a strain to grow"
            subtitle="Choose any seed below — it starts a local grow you can simulate."
          />
          <Field label="Grower name (optional)">
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Demo Grower"
            />
          </Field>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {DEMO_STRAINS.map((s) => (
              <button
                key={s.slug}
                type="button"
                onClick={() => setGrow(startDemo(name, s.slug))}
                aria-label={`Grow ${s.name}`}
                className="flex flex-col gap-1 rounded-lg border border-ink-600 bg-ink-900 p-2.5 text-left transition-colors hover:border-grow-500/60 hover:bg-grow-700/10"
              >
                <span className="text-sm font-bold text-gray-100">{s.name}</span>
                <span className="text-[10px] uppercase tracking-wide text-gray-400">
                  {s.lineage} · {s.rarity}
                </span>
                <span className="text-[10px] text-gray-500">
                  THC {s.thc}% · flower ~{s.floweringDays[0]}–{s.floweringDays[1]}d
                </span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-gray-500">
            No account or backend needed. This is a local demo grow — actions and growth
            happen on this device only and never sync to the cloud.
          </p>
          <p className="mt-2 text-[11px] text-gray-500">
            <Link href="/onboarding" className="underline">
              Use real cloud login instead →
            </Link>
          </p>
        </Card>
      </div>
    );
  }

  const flags = demoFlags(grow);
  const isDead = grow.health <= 0;
  const isHarvest = grow.stage === "harvest";

  const apply = (next: DemoGrow) => {
    setGrow(next);
    setSavedAt(false);
  };

  return (
    <div className="mx-auto max-w-md p-4">
      <Banner />
      <Card>
        <CardHeader
          title={`${grow.growerName} — ${grow.podName}`}
          subtitle={`${grow.strainName} · Day ${grow.day} · ${STAGE_LABEL[grow.stage]}`}
        />

        <div className="flex flex-col items-center">
          <PlantVisual stage={grow.stage} flags={flags} size={160} />
          {isDead && (
            <p className="mt-2 text-sm text-red-400">
              Your plant didn&apos;t make it. Reset to try again.
            </p>
          )}
          {isHarvest && !isDead && (
            <p className="mt-2 text-sm text-grow-200">🌿 Harvest-ready! (demo)</p>
          )}
        </div>

        {showStats && (
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <Stat label="Health" value={`${Math.round(grow.health)}%`} />
            <Stat label="Water" value={`${Math.round(grow.water)}%`} />
            <Stat label="Nutrients" value={`${Math.round(grow.nutrients)}%`} />
            <Stat label="Light" value={grow.light ? "On" : "Off"} />
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => apply(waterPlant(grow))} disabled={isDead}>
            💧 Water
          </Button>
          <Button variant="secondary" onClick={() => apply(feedPlant(grow))} disabled={isDead}>
            🌱 Feed
          </Button>
          <Button variant="secondary" onClick={() => apply(toggleLight(grow))} disabled={isDead}>
            💡 Light: {grow.light ? "On" : "Off"}
          </Button>
          <Button variant="secondary" onClick={() => setShowStats((s) => !s)}>
            🔍 Inspect
          </Button>
        </div>

        <div className="mt-2">
          <Button
            className="w-full"
            onClick={() => apply(advanceDay(grow))}
            disabled={isDead || isHarvest}
          >
            ⏭ Advance Day
          </Button>
        </div>

        <div className="mt-3 flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => {
              saveDemo(grow);
              setSavedAt(true);
            }}
          >
            {savedAt ? "Saved ✓" : "Save"}
          </Button>
          <Button
            variant="ghost"
            className="flex-1"
            onClick={() => {
              resetDemo();
              setGrow(null);
              setName("");
            }}
          >
            Reset demo
          </Button>
        </div>

        <p className="mt-3 text-[11px] text-gray-500">
          Local demo — growth and actions are simulated on this device and are not the real
          server simulation, cloud save, or wallet/chain.{" "}
          <Link href="/onboarding" className="underline">
            Use real cloud login →
          </Link>
        </p>
      </Card>
    </div>
  );
}
