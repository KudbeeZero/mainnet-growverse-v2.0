import type { ReactNode } from "react";
import { NavBar } from "./NavBar";
import { MobileTabBar } from "./MobileTabBar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <NavBar />
      {/* Bottom padding clears the fixed mobile tab bar (incl. the home-indicator
          safe area); removed at lg where the bar is hidden. */}
      <main className="mx-auto max-w-6xl px-4 py-6 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-6">
        {children}
      </main>
      <MobileTabBar />
    </div>
  );
}
