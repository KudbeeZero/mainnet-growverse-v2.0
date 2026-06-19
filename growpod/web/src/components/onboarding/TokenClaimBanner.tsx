"use client";

// First-load notice nudging the player to claim their starting tokens in the
// Profile area. Persisted per-player so it doesn't nag once acted on/dismissed.

import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { useOnboardingStore } from "@/lib/onboarding/onboardingStore";

export function TokenClaimBanner() {
  const router = useRouter();
  const { playerId, isAuthed, hydrated } = useSession();
  const dismissed = useOnboardingStore((s) => s.isBannerDismissed);
  const dismiss = useOnboardingStore((s) => s.dismissBanner);

  if (!hydrated || !isAuthed || !playerId || dismissed(playerId)) return null;

  const goProfile = () => {
    dismiss(playerId);
    router.push("/profile");
  };

  return (
    <div
      data-onboarding="token-banner"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-grow-700 bg-grow-900/40 px-4 py-3"
    >
      <p className="text-sm text-grow-100">
        🎁 <strong>Claim your 5,000 tokens</strong> in your Profile.
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={goProfile}
          className="rounded-md bg-grow-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-grow-500"
        >
          Go to Profile
        </button>
        <button
          onClick={() => dismiss(playerId)}
          aria-label="Dismiss"
          className="rounded-md px-2 py-1.5 text-sm text-gray-400 hover:bg-ink-700 hover:text-gray-200"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
