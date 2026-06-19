"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/session";
import { NAV_LINKS, isActiveLink, navOnboardingId } from "./navLinks";
import { PlayerBadge } from "./PlayerBadge";
import { useDevSpeedStore } from "@/lib/devSpeedStore";

export function NavBar() {
  const pathname = usePathname();
  const { isAuthed } = useSession();
  const { devSpeed, toggle } = useDevSpeedStore();

  return (
    <header className="sticky top-0 z-30 border-b border-ink-700 bg-ink-900/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex min-w-0 items-center gap-6">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 font-bold text-grow-300"
          >
            <span className="text-xl">🌿</span>
            <span className="hidden sm:inline">GrowPod Empire</span>
          </Link>
          {/* Desktop nav: the bottom tab bar (MobileTabBar) takes over below lg. */}
          {isAuthed && (
            <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
              {NAV_LINKS.map((l) => {
                const active = isActiveLink(pathname, l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    data-onboarding={navOnboardingId(l.href)}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                      active
                        ? "bg-grow-700 text-white"
                        : "text-gray-300 hover:bg-ink-700 hover:text-white"
                    }`}
                  >
                    {l.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isAuthed && (
            <button
              onClick={toggle}
              title={devSpeed ? "10× speed ON — click to disable" : "Enable 10× time acceleration"}
              className={`relative flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold tracking-wide transition-all duration-300 ${
                devSpeed
                  ? "border-green-400 bg-green-500/20 text-green-300 shadow-[0_0_12px_rgba(74,222,128,0.5)]"
                  : "border-ink-600 bg-ink-800 text-gray-500 hover:border-green-700 hover:text-green-400"
              }`}
            >
              {/* Slow glow pulse ring when active */}
              {devSpeed && (
                <span className="animate-ping pointer-events-none absolute inset-0 rounded-full border border-green-400/60" />
              )}
              ⚡ 10×
            </button>
          )}
          <PlayerBadge />
        </div>
      </div>
    </header>
  );
}
