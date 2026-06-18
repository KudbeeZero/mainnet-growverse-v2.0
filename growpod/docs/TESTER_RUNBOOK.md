# GrowPod Empire — Tester Runbook

Welcome, and thanks for testing! This is a **test build** — seeds are free, the
daily bonus is boosted, and you can fast-forward time. Nothing here is real money.

## Getting in (30 seconds)

1. Open the test URL you were given (a `https://…trycloudflare.com` link).
   > It's an ephemeral tunnel — if the link stops working, ask for a fresh one.
2. On the welcome screen, click **"Enter as tester → skip login"**.
   - This drops you straight into the game with a throwaway account — no password,
     no wallet, no setup.
   - *(Prefer the normal flow? Use "New account" to create a player and save the
     API key, or "I have a key" to sign back in.)*

## What to try (the core loop)

Please walk the whole loop at least once and note anything confusing or broken:

1. **Plant** a seed into a pod (you start with a free seed + pod).
2. **Care** for it — water, feed, set the climate. Watch the chamber react.
3. **Fast-forward** — use the dev speed / time controls to advance the grow
   (a tester convenience; not in the real game). The plant should progress
   through veg → flower.
4. **Harvest** when it's ready, then **cure** the harvest.
5. **Sell** (or breed / list on the market) and watch your GROW balance change.
6. Poke around the rest: strain lab, market, University, Cannabis Cup, profile.

### Specifically helpful to check
- **Mobile**: does it feel right on your phone? (tap targets, scrolling, the
  bottom nav, safe-area near the notch).
- **First-run clarity**: was it obvious what to do next at each step?
- **Anything that errors, freezes, looks wrong, or feels slow.**

## Reporting bugs

Please file each issue here (one issue per bug is ideal):

**https://github.com/kudbeezero/mainnet-growverse-v2.0/issues/new?template=bug_report.md**

Include: what you did, what you expected, what happened, your device/browser, and
a screenshot if you can. (No GitHub account? Send the same details to the owner.)

## Known test-build quirks (not bugs)
- Free seeds, a large daily bonus, and time fast-forward are intentional test
  conveniences — they'll be tuned back to real values before launch.
- The tunnel URL changes whenever the test server restarts.
