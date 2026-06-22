import type { ReactNode } from "react";
import { NavBar } from "./NavBar";
import { MobileTabBar } from "./MobileTabBar";
import { Footer } from "./Footer";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh]">
      <NavBar />
      {/* Bottom padding clears the fixed mobile tab bar (incl. the home-indicator
          safe area); removed at lg where the bar is hidden. Left/right padding
          folds in the landscape notch insets so content never hides under it. */}
      <main className="mx-auto max-w-6xl py-6 pb-[calc(5rem+env(safe-area-inset-bottom))] pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))] lg:pb-6">
        {children}
        <Footer />
      </main>
      <MobileTabBar />
    </div>
  );
}
