"use client";

// The main login page — rebuilt as a scroll-driven cinematic landing ("the method",
// minus the generative video): Lenis smooth-scroll + GSAP ScrollTrigger pacing, the
// six baked-in effects (film grain, particles, vignette, glass cards, color tints,
// scroll pacing), ending in the existing login/create card. Auth wiring is unchanged
// (OnboardingPanel + useSession). Reduced-motion → everything renders static.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useSession } from "@/lib/session";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useSmoothScroll } from "@/lib/scroll/useSmoothScroll";
import { CinematicBackdrop } from "@/components/landing/CinematicBackdrop";
import { GrainOverlay } from "@/components/landing/GrainOverlay";
import { HeroSection } from "@/components/landing/HeroSection";
import { StoryBeat } from "@/components/landing/StoryBeat";
import { LoginSection } from "@/components/landing/LoginSection";
import { AnnouncementsBanner } from "@/components/layout/AnnouncementsBanner";

const Constellation = dynamic(
  () => import("@/components/viz/Constellation").then((m) => m.Constellation),
  { ssr: false, loading: () => null },
);

export default function OnboardingPage() {
  const { isAuthed, hydrated } = useSession();
  const router = useRouter();
  const reduced = usePrefersReducedMotion();
  // Smooth-scroll + ScrollTrigger lifecycle (no-op under reduced motion).
  useSmoothScroll(!reduced);

  useEffect(() => {
    if (hydrated && isAuthed) router.replace("/dashboard");
  }, [hydrated, isAuthed, router]);

  return (
    <div className="relative">
      <CinematicBackdrop />
      <GrainOverlay />

      {/* News floats over the hero so it never covers the wordmark. */}
      <AnnouncementsBanner className="absolute inset-x-0 top-0 z-40 mx-auto max-w-3xl px-4 pt-3" />

      <main className="relative z-10">
        <HeroSection />

        <StoryBeat
          eyebrow="THE GENOME"
          title="A genome is a graph — so we render it as one."
          body={
            <>
              Every strain carries real, heritable traits across multiple gene loci. Breed two
              cultivars and the offspring inherit a provable lineage — not a random reroll. The
              living particle leaf you see is that genome, rendered as a force-directed graph.
            </>
          }
          visual={
            <div className="panel h-full w-full overflow-hidden p-2">
              <Constellation mode="leaf" frameless lockView height={340} leafCount={150} showCount={false} accent="#76c024" />
            </div>
          }
        />

        <StoryBeat
          flip
          eyebrow="THE SIMULATION"
          title="Seed to harvest, in real time."
          body={
            <>
              A pure, server-authoritative engine grows every plant tick-by-tick — light, water,
              nutrients, trichome ripeness. Dial the chamber in, watch the buds frost over, and
              harvest at the perfect window.
            </>
          }
          visual={
            <div className="grid h-full grid-cols-2 gap-3">
              {[
                { k: "THC", v: "18–28%" },
                { k: "FLOWERING", v: "55–70d" },
                { k: "YIELD", v: "400–600g" },
                { k: "TRICHOMES", v: "live" },
              ].map((s) => (
                <div key={s.k} className="panel flex flex-col items-center justify-center gap-1 p-4 shadow-glow-soft">
                  <span className="instrument-label text-accent-400">{s.k}</span>
                  <span className="text-xl font-bold text-gray-50">{s.v}</span>
                </div>
              ))}
            </div>
          }
        />

        <StoryBeat
          eyebrow="THE PROOF"
          title={
            <>
              Discover it, breed it, <span className="text-glow-accent text-accent-300">own it.</span>
            </>
          }
          body={
            <>
              Register a discovered cultivar on a verifiable family tree and mint it on-chain. A
              rare phenotype you found in week one becomes a provably scarce asset — its lineage
              readable by anyone, forever.
            </>
          }
        />

        <LoginSection />
      </main>
    </div>
  );
}
