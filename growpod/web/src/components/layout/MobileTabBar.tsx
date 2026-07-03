"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/session";
import {
  useNavLinks,
  isActiveLink,
  navOnboardingId,
  type NavLink,
} from "./navLinks";
import { RestartTutorialButton } from "@/components/onboarding/RestartTutorialButton";

/**
 * Mobile bottom tab bar — the native-app navigation pattern, shown below `lg`
 * (the desktop header `NavBar` takes over at `lg+`). Primary destinations get
 * thumb-reachable tabs; the rest live behind a "More" bottom sheet.
 *
 * Sits above the iPhone home indicator via `env(safe-area-inset-bottom)`
 * (requires `viewport-fit=cover`, set in the root layout's viewport export).
 */
export function MobileTabBar() {
  const pathname = usePathname();
  const { isAuthed } = useSession();
  const { primaryLinks, secondaryLinks } = useNavLinks();
  const [moreOpen, setMoreOpen] = useState(false);

  // Close the sheet whenever the route changes (e.g. a tab was tapped).
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // Close on Escape while the sheet is open.
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  if (!isAuthed) return null;

  // Immersive full-screen routes (the Grow Chamber + the Command Center deck)
  // own the whole viewport and supply their own back affordance — the app tab
  // bar must step aside so it never paints over their bottom controls.
  if (pathname.includes("/chamber") || pathname.includes("/command")) return null;

  const moreActive = secondaryLinks.some((l) => isActiveLink(pathname, l.href));

  return (
    <>
      {/* More sheet — slides up from the bottom edge, sits above the tab bar. */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setMoreOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="More navigation"
            className="absolute inset-x-0 bottom-0 animate-fade-up rounded-t-2xl border-t border-ink-600 bg-ink-900/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto h-1 w-10 rounded-full bg-ink-600" />
            <nav aria-label="More" className="grid gap-1 p-3">
              {secondaryLinks.map((l) => {
                const active = isActiveLink(pathname, l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-lg px-4 py-3 text-base transition-colors ${
                      active
                        ? "bg-grow-700 text-white"
                        : "text-gray-200 hover:bg-ink-700 active:bg-ink-700"
                    }`}
                  >
                    <span className="text-xl" aria-hidden>
                      {l.icon}
                    </span>
                    {l.label}
                  </Link>
                );
              })}
            </nav>
            <div className="flex justify-center px-4 pb-4 pt-1">
              <RestartTutorialButton />
            </div>
          </div>
        </div>
      )}

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-700 bg-ink-900/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <div className="mx-auto flex max-w-md items-stretch justify-around">
          {primaryLinks.map((l) => (
            <Tab key={l.href} link={l} active={isActiveLink(pathname, l.href)} />
          ))}
          <button
            type="button"
            data-onboarding="profile"
            onClick={() => setMoreOpen((o) => !o)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            aria-current={moreActive ? "page" : undefined}
            className={`flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] transition-colors ${
              moreActive || moreOpen
                ? "text-grow-300"
                : "text-gray-400 active:text-gray-100"
            }`}
          >
            <span className="text-xl leading-none" aria-hidden>
              ☰
            </span>
            <span className="font-medium tracking-wide">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}

function Tab({ link, active }: { link: NavLink; active: boolean }) {
  return (
    <Link
      href={link.href}
      data-onboarding={navOnboardingId(link.href)}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] transition-colors ${
        active ? "text-grow-300" : "text-gray-400 active:text-gray-100"
      }`}
    >
      <span
        className={`text-xl leading-none transition-transform ${active ? "scale-110" : ""}`}
        aria-hidden
      >
        {link.icon}
      </span>
      <span className="font-medium tracking-wide">{link.label}</span>
    </Link>
  );
}
