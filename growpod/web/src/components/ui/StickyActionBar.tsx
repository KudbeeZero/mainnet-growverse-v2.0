"use client";

import type { ReactNode } from "react";

/**
 * A mobile-only sticky action bar that floats in the thumb zone, directly above
 * the global `MobileTabBar`, so the most important action stays reachable
 * one-handed no matter how far the page is scrolled. Hidden at `lg+`, where
 * there's room for inline placement and no bottom tab bar.
 *
 * The `bottom` offset must track `MobileTabBar`'s height (`min-h-[3.25rem]` +
 * the home-indicator safe area) so the two never overlap. A top scrim fades
 * scrolling content into the bar so the floating CTA reads cleanly.
 */
export function StickyActionBar({ children }: { children: ReactNode }) {
  return (
    <div
      className="fixed inset-x-0 bottom-[calc(3.25rem+env(safe-area-inset-bottom))] z-20 lg:hidden"
      role="region"
      aria-label="Primary action"
    >
      <div className="bg-gradient-to-t from-ink-950 via-ink-950/85 to-transparent px-3 pb-2 pt-6">
        <div className="mx-auto max-w-md animate-fade-up">{children}</div>
      </div>
    </div>
  );
}
