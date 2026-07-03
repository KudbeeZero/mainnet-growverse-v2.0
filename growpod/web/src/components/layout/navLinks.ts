"use client";

/**
 * Single source of truth for the app's primary navigation.
 *
 * Consumed by both the desktop header (`NavBar`, shown ≥ lg) and the mobile
 * bottom tab bar (`MobileTabBar`, shown < lg). Keeping one list means the two
 * surfaces can never drift out of sync.
 *
 * `primary: true` links earn a slot in the mobile bottom bar (thumb-reach,
 * ≤ 4 + a "More" sheet — the native-app convention). The rest live behind
 * "More" on mobile but stay first-class on desktop.
 *
 * `feature` gates a link behind an MVP feature flag (`web/src/lib/features.ts`).
 * Gating happens **here**, at the shared source, so a flagged-off system (e.g.
 * Market/Cup/University) disappears from *both* the desktop nav and the mobile
 * tab bar in lock-step — never just one surface.
 */
import { FEATURES, useFeatureFlags, type FeatureName } from "@/lib/features";

export type NavLink = {
  href: string;
  label: string;
  /** Emoji glyph — matches the codebase's dependency-free, CSP-safe icon voice. */
  icon: string;
  /** Surfaced in the mobile bottom tab bar (vs. tucked into the "More" sheet). */
  primary?: boolean;
  /** Gate behind an MVP feature flag; links without one are always shown. */
  feature?: FeatureName;
};

const ALL_NAV_LINKS: NavLink[] = [
  { href: "/dashboard", label: "Grow", icon: "🌱", primary: true },
  { href: "/lab", label: "Lab", icon: "🧬", primary: true },
  { href: "/market", label: "Market", icon: "🛒", primary: true, feature: "marketplace" },
  { href: "/cup", label: "Cup", icon: "🏆", primary: true, feature: "cup" },
  { href: "/store", label: "Store", icon: "🏪" },
  { href: "/university", label: "University", icon: "🎓", feature: "university" },
  { href: "/leaderboards", label: "Leaderboards", icon: "📊" },
  { href: "/guide", label: "Guide", icon: "📖" },
  { href: "/profile", label: "Profile", icon: "👤" },
  { href: "/admin/economy", label: "Economy", icon: "📈" },
];

/** Nav links visible in this build per the env-driven fallback map — entries
 *  whose feature flag is OFF are dropped. Used as the SSR-safe default and by
 *  the structural unit tests; components should prefer `useNavLinks()` below,
 *  which reflects the backend's live flag state. */
export const NAV_LINKS: NavLink[] = ALL_NAV_LINKS.filter(
  (l) => !l.feature || FEATURES[l.feature],
);

/** Live nav links, filtered against the backend's real feature-flag state
 *  (`useFeatureFlags()`) rather than the build-time env fallback. This is what
 *  makes flipping a flag off on the backend actually hide the nav entry. */
export function useNavLinks(): {
  navLinks: NavLink[];
  primaryLinks: NavLink[];
  secondaryLinks: NavLink[];
} {
  const flags = useFeatureFlags();
  const navLinks = ALL_NAV_LINKS.filter((l) => !l.feature || flags[l.feature]);
  return {
    navLinks,
    primaryLinks: navLinks.filter((l) => l.primary),
    secondaryLinks: navLinks.filter((l) => !l.primary),
  };
}

/** True when `pathname` is on `href` or one of its sub-routes. */
export function isActiveLink(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * Stable `data-onboarding` id for a nav destination, so the guided tutorial can
 * spotlight the right tab on whichever surface is visible (desktop NavBar or
 * mobile tab bar). Returns undefined for links the tutorial doesn't target.
 */
const ONBOARDING_NAV_IDS: Record<string, string> = {
  "/dashboard": "grow-nav",
  "/lab": "lab-nav",
  "/market": "market-nav",
  "/cup": "cup-nav",
  "/guide": "guide",
  "/profile": "profile",
};
export function navOnboardingId(href: string): string | undefined {
  return ONBOARDING_NAV_IDS[href];
}

export const PRIMARY_LINKS = NAV_LINKS.filter((l) => l.primary);
export const SECONDARY_LINKS = NAV_LINKS.filter((l) => !l.primary);
