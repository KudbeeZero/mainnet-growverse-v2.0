---
name: capture-shots
description: Capture, regenerate, or archive visual-verification screenshots of the GROWv2 web app. Use BEFORE building any ad-hoc Playwright rig to screenshot a page or the chamber plant, when asked to visually verify a change, or to look up how a screen/plant looked in a prior round (the chapter list). Covers the shared mock-API fixtures, the parameterized capture harness, the browserless plant renderer, and the golden-promotion rules.
---

# /capture-shots — screenshot once, reference forever

The archive lives at `docs/memory/VERIFIED_RENDERS.md` (**the chapter list**) with committed
golden images in `docs/memory/verification/golden/`. **Check it first** — the render you need
may already exist, or have a one-command regen recipe. Never rebuild a throwaway rig.

## 0. Looking for a PAST render?

Grep the chapter list for the subject (strain / stage / route / round). Golden → open the
committed PNG. Regen-only → run the recorded command; if the look is version-pinned, run it at
the recorded SHA (`git worktree add` if you must not disturb the working tree).

## 1. Plant renders — no browser needed (fastest, try this first)

`cd web && npm run gen:stages` drives the real `chamberCore` engine through `@napi-rs/canvas`:
8 strains × 7 stages + macro in seconds, no server, no Chromium, fully deterministic
(seed-driven). Output: gitignored `web/canonical-stages/`. Reach for Playwright only when you
need the full page (HUD, shell, DOM overlays) rather than the plant itself.

## 2. Full UI screens — the parameterized harness

No spec-writing, no config-patching:

```bash
cd web
CAPTURE_ROUTE=/dashboard/plants/plant1/chamber npx playwright test capture
CAPTURE_ROUTE=/lab/microscope CAPTURE_NAME=microscope npx playwright test capture
CAPTURE_ROUTE=/dashboard CAPTURE_STATE='growth_stage=harvest' npx playwright test capture
```

- Vars: `CAPTURE_ROUTE` (required), `CAPTURE_STATE` (k=v,… plant/state overrides),
  `CAPTURE_VIEWPORTS` (default `1440x900,390x844` — the blessed pair), `CAPTURE_NAME`,
  `CAPTURE_OUT` (default gitignored `e2e-output/capture/`), `CAPTURE_WAIT` (ms, default 1800),
  `CAPTURE_CANVAS=1` (also shoot the first `<canvas>` alone — the chamber plant).
- The spec self-skips when `CAPTURE_ROUTE` is unset, so it costs nothing in CI/normal runs.
- Mock game state comes from `web/e2e/fixtures/mockGame.ts` (auth seed + full API mock).
  Import `setup(page, stateOver, extraOverrides)` from there for bespoke flows (clicking
  through UI before shooting) instead of copying fixtures into a new file.
- **Browser path is handled**: `web/playwright.config.ts` auto-detects the cloud sandbox's
  Chromium (`/opt/pw-browsers/chromium`) and honors a `PW_CHROMIUM` env override. Do NOT
  hand-patch the config; that ritual is dead.

## 3. Archiving — recipes always, pixels when they matter

- Default: shots stay in gitignored `e2e-output/` (session-local, fine for review).
- **Every session that produces verification evidence adds a chapter-list row** — for
  regen-only entries the command + SHA *is* the artifact. Cheap, always do it.
- **Promote to golden** (copy into `docs/memory/verification/golden/`, named
  `<round|feature>-<subject>-<state>.png`, + a row, same PR) only for owner-taste moments:
  round before/afters, approved looks, audit evidence. Golden approval is the owner's call —
  propose, don't self-approve. Keep the set curated; the repo is not a camera roll.
- `make check-memory` enforces that golden links in the chapter list resolve. A row citing a
  gitignored path must say `regen-only` in the Image column, never link it.

## 4. Don'ts

- Don't write one-off `*-recon.spec.ts` files that copy PLAYER/WALLET/setup() — import the
  fixtures module.
- Don't leave temp specs or config edits behind; the harness makes them unnecessary.
- Don't commit every capture — curate. Don't skip the manifest row — that's how the next
  agent finds your work instead of redoing it.
