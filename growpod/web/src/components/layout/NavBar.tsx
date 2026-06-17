"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/session";
import { NAV_LINKS, isActiveLink } from "./navLinks";
import { PlayerBadge } from "./PlayerBadge";
import { useDevSpeedStore } from "@/lib/devSpeedStore";

export function NavBar() {
  const pathname = usePathname();
  const { isAuthed } = useSession();

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
        <PlayerBadge />
      </div>
    </header>
  );
}
