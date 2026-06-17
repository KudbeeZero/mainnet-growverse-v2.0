"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { LoadingBlock } from "@/components/ui/Spinner";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthed, hydrated } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !isAuthed) router.replace("/onboarding");
  }, [hydrated, isAuthed, router]);

  if (!hydrated) return <LoadingBlock label="Loading session…" />;
  if (!isAuthed) return <LoadingBlock label="Redirecting…" />;
  return <>{children}</>;
}
