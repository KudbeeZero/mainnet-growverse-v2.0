"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/lib/session";
import { ToastProvider } from "@/components/ui/Toast";
import { AuthErrorListener } from "@/components/layout/AuthErrorListener";
import { OnboardingProvider } from "@/components/onboarding/OnboardingProvider";
import { WalletProvider } from "@/lib/wallet/WalletProvider";

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
          <WalletProvider>
            <OnboardingProvider>{children}</OnboardingProvider>
          </WalletProvider>
        </ToastProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
