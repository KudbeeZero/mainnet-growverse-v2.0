# Verified Renders — the chapter list (visual-verification archive)

> **What this is:** the durable index of visual-verification evidence, so no agent ever
> rebuilds a screenshot rig from scratch or loses an approved look when its session
> container dies. Every entry is either a committed **golden** image (in
> `verification/golden/`) or a **regen-only** recipe (one command + the git SHA it was
> captured at — the renders are deterministic *per code version*, so `git checkout <sha>`
> + the command reproduces it exactly).
>
> **How to capture / regenerate:** see the `capture-shots` skill
> (`.claude/skills/capture-shots/SKILL.md`). Short version: shared mock-API fixtures live
> in `web/e2e/fixtures/mockGame.ts`; the parameterized harness is
> `web/e2e/capture.spec.ts` (drive with `CAPTURE_ROUTE=… npx playwright test capture`);
> the browserless plant renderer is `npm run gen:stages`. The sandbox Chromium path is
> auto-detected by `web/playwright.config.ts` — never hand-patch it again.
>
> **Rules:** captures land in gitignored `e2e-output/` by default. Promoting one to
> golden = copy into `verification/golden/` + add a row here **in the same PR**. Keep
> goldens curated (owner-taste moments: round before/afters, approved looks — not every
> recon shot). Golden status is the owner's call; agents propose, the owner approves.
> Newest rows first within each chapter.

## Chapter 1 — Plant look rounds (chamber renderer)

| ID | Date | Round / PR | Subject | Regen @ SHA | Image | Verdict |
|----|------|-----------|---------|-------------|-------|---------|
| VER-005 | 2026-07-03 | 8c / PR #137 | Gelato, late_flower day 116, chamber canvas, desktop — AFTER leaf/bract texture layering | `CAPTURE_ROUTE=/dashboard/plants/plant1/chamber CAPTURE_STATE=growth_stage=late_flower CAPTURE_CANVAS=1 npx playwright test capture` @ `b7806d0` | [golden](verification/golden/r8c-gelato-lateflower-chamber-after.png) | pending owner re-verify — per-leaflet variation + per-bract shading landed |
| VER-004 | 2026-07-03 | 8b / PR #137 | Same scene, BEFORE 8c (post-#135 airy candelabra, pre-texture-layering) | same command @ `28ee409` | [golden](verification/golden/r8c-gelato-lateflower-chamber-before.png) | baseline for the 8c before/after; 3× crops of these two fulls were the review evidence |
| VER-003 | 2026-07-03 | 8b / #135 | PDP / G13 / Gelato full-chamber, airy-candelabra layout check | same command @ `9c1800c` (vary strain fixture) | regen-only | separated spears + dark air verified in-session |

## Chapter 2 — UI screens (Playwright, mock API)

| ID | Date | Round / PR | Subject | Regen @ SHA | Image | Verdict |
|----|------|-----------|---------|-------------|-------|---------|
| VER-008 | 2026-07-03 | microscope audit | /lab/microscope, desktop 1440×900, initial state | `CAPTURE_ROUTE=/lab/microscope CAPTURE_NAME=microscope npx playwright test capture` @ `b7806d0` | [golden](verification/golden/microscope-desktop-initial-2026-07-03.png) | recon evidence for the Lab-magnifier audit — current state, pre-rework |
| VER-007 | 2026-07-03 | microscope audit | /lab/microscope, maturity slider at 100% (amber) | same, then drag the maturity slider | [golden](verification/golden/microscope-desktop-maturity100-2026-07-03.png) | shows the slider's visible effect today |
| VER-006 | 2026-07-03 | microscope audit | /lab/microscope, mobile 390×844 | `CAPTURE_ROUTE=/lab/microscope CAPTURE_VIEWPORTS=390x844 npx playwright test capture` @ `b7806d0` | [golden](verification/golden/microscope-mobile-initial-2026-07-03.png) | recon evidence — mobile layout, pre-rework |
| VER-002 | 2026-07-03 | core loop / PR #118+ | /dashboard care loop + chamber-arcade + harvested next-actions | `npx playwright test care-loop-shot` (any green SHA) → `e2e-output/care-loop-*.png` | regen-only | the standing core-loop proof; regenerated on every gate run |

## Chapter 3 — Canonical stage matrix (browserless)

| ID | Date | Round / PR | Subject | Regen @ SHA | Image | Verdict |
|----|------|-----------|---------|-------------|-------|---------|
| VER-001 | 2026-06 | PR #29 | 8 strains × 7 stages + macro, rendered straight from `chamberCore` via `@napi-rs/canvas` — no browser, no server, seconds | `npm run gen:stages` (current HEAD) → gitignored `canonical-stages/` | regen-only | the fastest way to eyeball any strain × stage; use this before reaching for Playwright |

## Adding an entry (checklist)

1. Capture with the harness (see the skill). Default output is gitignored — fine for
   in-session review.
2. Worth keeping? Copy to `verification/golden/` with a descriptive
   `<round|feature>-<subject>-<state>.png` name, add a row (next `VER-###`), commit both
   together.
3. Regen-only entries still get a row — the command + SHA **is** the saved artifact.
4. `make check-memory` fails if a golden link here goes dead — that's intentional; fix
   the row, don't delete the gate.
