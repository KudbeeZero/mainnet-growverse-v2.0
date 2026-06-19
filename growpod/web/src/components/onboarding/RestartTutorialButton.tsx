"use client";

// Lets a returning player replay the guided tutorial. Renders nothing until the
// session is hydrated so it never flashes for logged-out visitors.

import { useSession } from "@/lib/session";
import { useOnboarding } from "./OnboardingProvider";

export function RestartTutorialButton({ className = "" }: { className?: string }) {
  const { hydrated, isAuthed } = useSession();
  const { restart } = useOnboarding();

  if (!hydrated || !isAuthed) return null;

  return (
    <button
      type="button"
      onClick={restart}
      className={`text-xs text-gray-400 underline-offset-2 hover:text-grow-300 hover:underline ${className}`}
    >
      ↻ Restart tutorial
    </button>
  );
}
