"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import type { Player } from "@/lib/types";

/**
 * Dev/test-only shortcut into the game.
 *
 * Auto-provisions a throwaway tester account via the normal create-player API
 * and jumps straight to the dashboard — bypassing the login screen, the
 * API-key reveal, and the FTUE tutorial (no password, no wallet). Rendered only
 * when `NEXT_PUBLIC_ENABLE_DEV_BYPASS=true` (see `lib/features.isDevBypassEnabled`),
 * which the test-env launch sets and production never does.
 */
export function DevSkipLoginButton() {
  const { login } = useSession();
  const router = useRouter();
  const toast = useToast();

  const mutation = useMutation<Player, ApiError>({
    mutationFn: () =>
      api.players.create(
        `tester-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      ),
    onSuccess: (player) => {
      if (!player.api_key) {
        toast.error("No API key returned");
        return;
      }
      login(player.id, player.api_key);
      router.replace("/dashboard");
    },
    onError: (e) => toast.error(`Bypass failed: ${e.message}`),
  });

  return (
    <div className="mx-auto mt-4 max-w-md">
      <div className="rounded-lg border border-amber-700/40 bg-amber-950/20 p-4 text-center">
        <p className="mb-2 text-xs uppercase tracking-wide text-amber-300/80">
          Dev / test build
        </p>
        <Button
          variant="secondary"
          className="w-full"
          loading={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Enter as tester → skip login
        </Button>
        <p className="mt-2 text-[11px] text-gray-500">
          Creates a throwaway account and drops you straight into the game — no
          password or wallet needed.
        </p>
      </div>
    </div>
  );
}
