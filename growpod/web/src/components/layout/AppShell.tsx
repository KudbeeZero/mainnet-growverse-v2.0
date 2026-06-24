"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { NavBar } from "./NavBar";
import { MobileTabBar } from "./MobileTabBar";
import { Footer } from "./Footer";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // The Command Center is a dense, multi-rail "app" surface — on big desktop
  // monitors the 1152px content cap left huge empty gutters. Let it break out to
  // a much wider container on large screens. Text-led pages (store, university,
  // profile, onboarding…) stay at the comfortable reading width.
  const wide = pathname === "/dashboard";
  const widthClass = wide
    ? "max-w-6xl xl:max-w-[88rem] 2xl:max-w-[104rem]"
    : "max-w-6xl";

  return (
    <div className="min-h-screen">
      <NavBar />
      {/* Bottom padding clears the fixed mobile tab bar (incl. the home-indicator
          safe area); removed at lg where the bar is hidden. */}
      <main
        className={`mx-auto ${widthClass} px-4 py-6 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-6`}
      >
        {children}
        <Footer />
      </main>
      <MobileTabBar />
    </div>
  );
}
