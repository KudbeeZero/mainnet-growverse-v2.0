"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { OnboardingPanel } from "@/components/onboarding/OnboardingPanel";
import { GroversWordmark } from "@/components/viz/GroversWordmark";
import { AnnouncementsBanner } from "@/components/layout/AnnouncementsBanner";

export default function OnboardingPage() {
  const { isAuthed, hydrated } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && isAuthed) router.replace("/dashboard");
  }, [hydrated, isAuthed, router]);

  return (
    <div className="py-6">
      {/* News lives in its own row above the hero — it can never cover the logo. */}
      <AnnouncementsBanner className="mb-8" />
      <div className="grid items-center gap-8 lg:grid-cols-2">
        <div>
          <GroversWordmark className="mb-2" />
          {/* reduced-motion renders one static frame — don't promise interaction */}
          <div className="instrument-label mb-5 text-center text-gray-600 motion-reduce:hidden">
            TOUCH THE LEAF · LIVE PARTICLES
          </div>
          <div className="mt-5">
            <div className="instrument-label mb-1">GALACTIC SERIES · GROWPOD EMPIRE</div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-50">
              Real genetics. Real time.{" "}
              <span className="text-glow-grow text-grow-300">Provably yours.</span>
            </h1>
            <p className="mt-2 max-w-md text-sm text-gray-400">
              Cultivate a living simulation, breed discovered cultivars, and register them on a
              verifiable family tree. A genome is a graph — so we render it as one.
            </p>
          </div>
        </div>
        <div className="lg:pl-6">
          <OnboardingPanel />
        </div>
      </div>
    </div>
  );
}
