"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { LoadingBlock } from "@/components/ui/Spinner";

export default function Home() {
  const { isAuthed, hydrated } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    router.replace(isAuthed ? "/dashboard" : "/onboarding");
  }, [hydrated, isAuthed, router]);

  return <LoadingBlock label="Starting…" />;
}
