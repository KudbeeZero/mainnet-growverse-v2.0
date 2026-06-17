# Audit — PR #15: GROVERS v2 living particle-leaf hero + announcements banner

**Branch:** `claude/grovers-particle-leaf-i1s759` → `main` · **Head SHA:** `4467a6e` · **Auditor run:** 2026-06-11
**CI on the PR:** merged to main as `c42383d` · **Reviewer:** independent auditor (does not trust PR prose)

> This receipt records a three-party pass: builder → helper (second eyes) → independent
> auditor, plus a post-merge advisor sweep. PR #15 was merged by the owner mid-session;
> the advisor's fixes ship in a follow-up PR on the same branch.

## Claims vs. evidence
| # | PR claims | Verified? | Evidence (`file:line`) |
|---|-----------|-----------|------------------------|
| 1 | Leaf-mode neighbor mesh (nearest-2 within radius, deduped) | ✅ | `web/src/components/viz/Constellation.tsx` — mesh built after `eList`, body particles only (`p.id[0] === "p"`), `LINK_R2 = 0.0045`, `Set`-keyed dedupe |
| 2 | Hover/touch proximity repulsion in leaf mode (no drag needed) | ✅ | `Constellation.tsx` `onMove` — leaf branch fires on plain hover; `d2 < 0.05` → velocity push |
| 3 | Sacred render bodies untouched | ✅ | sha256 of brace-matched `leafParticles`/`graphParticles`/`step`/`draw` re-derived 4× by node script; all four match the pins in `constellationLifecycle.test.ts` |
| 4 | GROVERS wordmark with the leaf as the O | ✅ | `web/src/components/viz/GroversWordmark.tsx` — quantized `oSize`, row-budget ≈3.9×oSize ≤ width, `role="img"` |
| 5 | Announcements banner that cannot overlap the logo | ✅ | `web/src/app/onboarding/page.tsx:21` — own row above the hero grid; `AnnouncementsBanner.tsx` is WCAG-2.2.2-pause-aware, not `aria-live` |
| 6 | Anti-bot framework spec "logged in detail" on the backlog | ✅ | `docs/memory/BACKLOG.md` — Medium item with all 7 mechanisms; build gated on owner green-light |

## Gates re-run by the auditor
- `make test` → 197 passed, coverage 80% (exit 0, run twice)
- `make lint` → ✅
- `make check-memory` → ✅
- web `npm run build` → ✅ (vitest still an `echo` stub — RISK #8; contracts verified by hand-replicated node hash scripts)

## Scope check
- In-scope diff: `web/src/components/viz/*`, `web/src/components/layout/AnnouncementsBanner.tsx`, `web/src/lib/announcements.ts`, `web/src/app/onboarding/page.tsx`, `docs/memory/BACKLOG.md`, egg-info untrack
- **Scope creep / out-of-scope changes:** none in PR #15. Governance changes (`CLAUDE.md` charter, `.claude/settings.json`) were intentionally split into the follow-up PR.

## Carried-risks ledger check
- Any OPEN RISK silently dropped from `docs/HANDOFF.md`? no
- Any risk marked FIXED **without** a test backing it? no (deferred perf items logged in `BACKLOG.md`, flagged as needing a sacred re-pin)

## Device-verifiable vs agent-verifiable
- Agent proved: hashes pinned, gates green, mesh/repulsion code paths present, banner row cannot overlap the hero.
- Owner must confirm by hand: the leaf *feels* right on a real phone (touch repulsion, no scroll-jank with `touch-pan-y`).

## Post-merge advisor sweep (follow-up PR, same branch)
- PROBLEMS found: stranded governance commit after the owner's button-merge (fixed by rebase onto main); permission rules had prefix-match evasion holes (`git push origin +main`, bare `-f`, `:branch` deletes) and a `Bash(node *)` arbitrary-exec hatch (fixed: wildcards removed, pushes narrowed to `claude/*`, deny variants added); baton addendum misattributed governance work to PR #15 (fixed); this receipt was missing (fixed).

## Verdict
**PASS** — all six claims verified with evidence; helper's SHIP-WITH-FIXES items all landed; advisor's post-merge findings fixed in the follow-up PR.
