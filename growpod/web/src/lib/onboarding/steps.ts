// The guided first-session onboarding script. Each step either shows a centered
// welcome/finish card (no target) or spotlights a real UI element resolved by
// its `data-onboarding` attribute, advancing only when the player completes the
// required action (click / select / navigate) — or via Next where allowed.

export type AdvanceRule =
  /** Advance when the player presses Next (welcome, finish, info, fallbacks). */
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
  /** Show a secondary "Next" even on action steps (graceful escape + steps
   *  whose action may not be available yet). */
  allowNext?: boolean;
  /** Preferred bubble placement relative to the target. */
  placement?: "auto" | "top" | "bottom";
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    text: "Welcome to GrowVerse. Let’s plant your first seed and get your first grow moving.",
    advance: { kind: "next" },
  },
  {
    id: "open-profile",
    text: "Start by claiming your 5,000 tokens in your Profile.",
    target: "profile",
    advance: { kind: "route-or-click", path: "/profile" },
    allowNext: true,
  },
  {
    id: "claim-tokens",
    text: "Claim your tokens here — you’ll spend them on seeds, pods, and care. (Already claimed? Press Next.)",
    target: "claim-tokens",
    advance: { kind: "click" },
    allowNext: true,
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
    text: "Choose a seed. Each seed can become a plant with its own growth path.",
    target: "seed-select",
    advance: { kind: "change" },
    allowNext: true,
  },
  {
    id: "plant-seed",
    text: "Now plant it in your Starter Pod — this starts the growth cycle.",
    target: "plant-here",
    advance: { kind: "click" },
    allowNext: true,
  },
  {
    id: "understand-stage",
    text: "Your plant moves through stages over time. During testing, QA 10× speed can make this happen faster.",
    target: "plant-card",
    advance: { kind: "next" },
    allowNext: true,
  },
  {
    id: "open-plant",
    text: "Tap your plant to see its mood, journal, and suggestions.",
    target: "plant-card",
    advance: { kind: "route-or-click", path: "/dashboard/plants" },
    allowNext: true,
  },
  {
    id: "read-suggestions",
    text: "Suggestions explain what your plant needs and what’s happening inside it.",
    target: "plant-suggestions",
    advance: { kind: "next" },
    allowNext: true,
  },
  {
    id: "tend-plant",
    text: "Water, feed, and keep the environment dialed in to help it grow.",
    target: "care-actions",
    advance: { kind: "click" },
    allowNext: true,
  },
  {
    id: "explore-lab",
    text: "The Lab is where genetics and deeper plant systems will expand.",
    target: "lab-nav",
    advance: { kind: "route-or-click", path: "/lab" },
    allowNext: true,
    placement: "top",
  },
  {
    id: "explore-market",
    text: "The Market is for buying and selling — some parts are still being built and are labeled honestly.",
    target: "market-nav",
    advance: { kind: "route-or-click", path: "/market" },
    allowNext: true,
    placement: "top",
  },
  {
    id: "explore-cup",
    text: "The Cup will become the competition layer — coming soon.",
    target: "cup-nav",
    advance: { kind: "route-or-click", path: "/cup" },
    allowNext: true,
    placement: "top",
  },
  {
    id: "open-guide",
    text: "The Grow Guide explains every system and what’s live vs coming soon. Open it anytime.",
    target: "guide",
    advance: { kind: "route-or-click", path: "/guide" },
    allowNext: true,
    placement: "top",
  },
  {
    id: "finish",
    text: "You’re ready. Grow strong, claim rewards, and build your empire. (Replay anytime from the Guide or More menu.)",
    advance: { kind: "next" },
  },
];
