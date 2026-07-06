"use client";

import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/States";

export default function ProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="text-3xl">👤</div>
      <ErrorState error={error} />
      <Button onClick={reset}>Reload your profile</Button>
    </div>
  );
}
