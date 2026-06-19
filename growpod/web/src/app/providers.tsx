"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/lib/session";
import { ToastProvider } from "@/components/ui/Toast";
import { AuthErrorListener } from "@/components/layout/AuthErrorListener";
import { OnboardingProvider } from "@/components/onboarding/OnboardingProvider";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <SessionProvider>
        <AuthErrorListener />
        <ToastProvider>
          <OnboardingProvider>{children}</OnboardingProvider>
        </ToastProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
