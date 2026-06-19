// The guided first-session onboarding script. Each step either shows a centered
// welcome/finish card (no target) or spotlights a real UI element resolved by
// its `data-onboarding` attribute, advancing only when the player completes the
// required action (click / select / navigate) — or via Next where allowed.

export type AdvanceRule =
  /** Advance when the player presses Next (welcome, finish, fallbacks). */
  | { kind: "next" }
  /** Advance when the player clicks the spotlighted target. */
  | { kind: "click" }
  /** Advance when the spotlighted <select> fires a change. */
  | { kind: "change" }
  /** Advance when the app navigates to `path` (robust for nav taps). */
  | { kind: "route"; path: string }
  /** Advance on either clicking the target or arriving at `path`. */
  | { kind: "route-or-click"; path: string };

export interface OnboardingStep {
  id: string;
  text: string;
  /** `data-onboarding` value to spotlight. Omit for a centered card. */
  target?: string;
  advance: AdvanceRule;
  /** Show a secondary "Next" even on action steps (used as a graceful escape
   *  and for steps whose action may not be available yet). */
  allowNext?: boolean;
  /** Preferred bubble placement relative to the target. */
  placement?: "auto" | "top" | "bottom";
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    text: "Welcome to GrowPod Empire. Let’s get your first grow started.",
    advance: { kind: "next" },
  },
  {
    id: "open-profile",
    text: "First, claim your 5,000 starting tokens from your Profile.",
    target: "profile",
    advance: { kind: "route-or-click", path: "/profile" },
    allowNext: true,
    placement: "auto",
  },
  {
    id: "claim-tokens",
    text: "Claim your tokens here. You’ll use them for seeds, pods, upgrades, and growth. (Already claimed? Just press Next.)",
    target: "claim-tokens",
    advance: { kind: "click" },
    allowNext: true,
    placement: "auto",
  },
  {
    id: "back-to-grow",
    text: "Now head back to your Grow dashboard.",
    target: "grow-nav",
    advance: { kind: "route-or-click", path: "/dashboard" },
    allowNext: true,
    placement: "top",
  },
  {
    id: "select-seed",
    text: "Choose your first seed.",
    target: "seed-select",
    advance: { kind: "change" },
    allowNext: true,
    placement: "auto",
  },
  {
    id: "plant-seed",
    text: "Plant your seed in the Starter Pod.",
    target: "plant-here",
    advance: { kind: "click" },
    allowNext: true,
    placement: "auto",
  },
  {
    id: "open-plant",
    text: "Tap your plant to open its care panel.",
    target: "plant-card",
    advance: { kind: "route-or-click", path: "/dashboard/plants" },
    allowNext: true,
    placement: "auto",
  },
  {
    id: "tend-plant",
    text: "Water, feed, and keep your plant in the right environment to help it grow.",
    target: "care-actions",
    advance: { kind: "click" },
    allowNext: true,
    placement: "auto",
  },
  {
    id: "explore-lab",
    text: "The Lab is where upgrades, genetics, and deeper plant intelligence will live.",
    target: "lab-nav",
    advance: { kind: "route-or-click", path: "/lab" },
    allowNext: true,
    placement: "top",
  },
  {
    id: "explore-market",
    text: "The Market is where seeds, supplies, and future trading will happen.",
    target: "market-nav",
    advance: { kind: "route-or-click", path: "/market" },
    allowNext: true,
    placement: "top",
  },
  {
    id: "explore-cup",
    text: "The Cup is where competitions and grow rankings will live.",
    target: "cup-nav",
    advance: { kind: "route-or-click", path: "/cup" },
    allowNext: true,
    placement: "top",
  },
  {
    id: "finish",
    text: "You’re ready. Grow strong, claim rewards, and build your empire.",
    advance: { kind: "next" },
  },
];
