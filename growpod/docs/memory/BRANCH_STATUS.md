# Branch Status Register

> **Last audited:** 2026-07-03 (session `claude/research-pr-review-1whd6v`)
> **Total branches:** 133 (100 `claude/*` + 16 `design/*` + 2 `fix/*` + 1 `backup/*` + 1 `main` + 13 remaining page-2)
> **Action available to agent:** cannot delete remote branches (MCP has no delete-branch tool;
> local git branch-delete is gated by CLAUDE.md security policy). Owner can bulk-delete merged
> branches via GitHub → repository Settings → "View all branches" → delete icon.

## Summary

| Category | Count | Action |
|---|---|---|
| Merged into main — safe to delete | 112 | Owner bulk-delete via GitHub UI |
| Closed without merge — content superseded | 14 | Safe to delete; noted below |
| Closed without merge — **content NOT in main** | 1 | See PR #136 (stamps.ts + pistil/frost) |
| No PR found — orphaned dev stubs | 7 | Safe to delete after owner glance |
| Current working branch | 1 | `claude/research-pr-review-1whd6v` (active) |

---

## MERGED — safe to delete (112 branches)

All of these had their work merged into `main` via their associated PR.

| Branch | PR | Merged? |
|---|---|---|
| `backup/local-changes-2026-06-18` | #17 | ✅ |
| `claude/agent-evidence-memory-framework-ffkofk` | #23 | ✅ |
| `claude/algo-wallet-connect` | #54 | ✅ |
| `claude/algorand-dev-tooling` | #96 | ✅ |
| `claude/breeding-verify-terminal-ux` | #34 | ✅ |
| `claude/bud3d-calyx-polish` | #47 | ✅ |
| `claude/bud3d-detail` | #46 | ✅ |
| `claude/bud3d-engine` | #45 | ✅ |
| `claude/bud3d-server-truth` | #50 | ✅ |
| `claude/bud-fidelity` | #87 | ✅ |
| `claude/bud-render-polish` | #65 | ✅ |
| `claude/build-rules-safety-9iwep3` | #9 | ✅ |
| `claude/cinematic-factions` | #102 | ✅ |
| `claude/cloning-plant-growth-test-6ukh8w` | #7 | ✅ |
| `claude/code-review-security-vijkhs` | #104–110 | ✅ |
| `claude/command-care-tools` | #44 | ✅ |
| `claude/command-center-desktop-layout` | #71 | ✅ |
| `claude/cross-view-consistency` | #57 | ✅ |
| `claude/dashboard-speedup` | #55 | ✅ |
| `claude/db-systems-audit` | #20 | ✅ |
| `claude/demo-seed-picker` | #52 | ✅ |
| `claude/dev-plant-review-panel` | #27 | ✅ |
| `claude/dev-tester-time-controls` | #64 | ✅ |
| `claude/economy-idempotency-hardening` | #12 | ✅ |
| `claude/engine-late-flower-web-deps-08b2vn` | #8 | ✅ |
| `claude/faction-houses` | #99 | ✅ |
| `claude/faction-waitlist-backend` | #97 | ✅ |
| `claude/faction-waitlist-web` | #98 | ✅ |
| `claude/frontier-clone-room-pbhd7l` | #1 | ✅ |
| `claude/frontier-fly-deployment-prep-gs4t2z` | #28 | ✅ |
| `claude/game-enrichers` | #67 | ✅ |
| `claude/game-speed-10x` | #38 | ✅ |
| `claude/global-turbo-faucet` | #42 | ✅ |
| `claude/grok-assist` | #16 | ✅ |
| `claude/growverse-audit-baton-yqd63o` | #24 | ✅ |
| `claude/growverse-local-setup-9cp6qd` | #5 | ✅ |
| `claude/growverse-product-docs` | #32 | ✅ |
| `claude/harvest-trichome-quality` | #53 | ✅ |
| `claude/immersive-university-research` | #70 | ✅ |
| `claude/integrate-deploy-config` | #31 | ✅ |
| `claude/integrate-local-demo` | #30 | ✅ |
| `claude/integrate-onboarding` | #29 | ✅ |
| `claude/ledger-6a-visuals` | #85 | ✅ |
| `claude/login-cinematic` | #101 | ✅ |
| `claude/mission-control-v0` | #33 | ✅ |
| `claude/morphology-debug-panel-zlbia5` | #4 | ✅ |
| `claude/onboarding-cinematic` | #94 | ✅ |
| `claude/onboarding-skip` | #62 | ✅ |
| `claude/paul-testing-prep-xk78mz` | #14 | ✅ |
| `claude/photoreal-blue-dream` | #88 | ✅ |
| `claude/pistil-hairs-round8` | #131 → absorbed by #133 | ✅ via #133 |
| `claude/plant-airy-candelabra` | #135 | ✅ |
| `claude/plant-animation-ai-agents-91fcgr` | #15 | ✅ |
| `claude/plant-round8-combined` | #133 | ✅ |
| `claude/plant-scouts-live-2a` | see below | closed |
| `claude/playwright-real-browser-evaluator-v6tie1` | #68/#69 | ✅ |
| `claude/pod-photoreal-stages` | #93 | ✅ |
| `claude/pod-view-bud` | #84 | ✅ |
| `claude/pr-lifecycle-deploy-visibility` | #37 | ✅ |
| `claude/preview-growth-scrubber` | #66 | ✅ |
| `claude/project-onboarding-review-vpx0aj` | #111–113 | ✅ |
| `claude/purchasable-growth-boost` | #56 | ✅ |
| `claude/real-plant-visual` | #40 | ✅ |
| `claude/repo-state-clarification-4ojv82` | #59/#60 merged; #61 closed | ✅ (see below for #61) |
| `claude/research-tab-store-expansion-ctzr5s` | #2 | ✅ |
| `claude/review-recent-changes-bwx8yh` | #63 | ✅ |
| `claude/rooms-sliders-depth` | #43 | ✅ |
| `claude/security-hardening-v1` | #35 | ✅ |
| `claude/seed-minting-genetics-ge15on` | #3 | ✅ |
| `claude/sim-engine-framework` | #48 | ✅ |
| `claude/sim-trichome-engine` | #49 | ✅ |
| `claude/status-closeout-format-3d3w0o` | #13 | ✅ |
| `claude/store-admin-helper-test` | #25 | ✅ |
| `claude/store-purchase-builders-test` | #26 | ✅ |
| `claude/strain-frost-sugarleaves` | #83 | ✅ |
| `claude/strain-heroes-gg4-wc` | #92 | ✅ |
| `claude/strain-visual-fidelity` | #82 | ✅ |
| `claude/timer-countdown-fix` | #39 | ✅ |
| `claude/trichome-precursor` | #51 | ✅ |
| `claude/turbo-watchable` | #58 | ✅ |
| `claude/university-admissions` | #89 | ✅ |
| `claude/university-agent-campus-plan` | #74 | ✅ |
| `claude/university-design-build-s7h7vk` | #72 | ✅ |
| `claude/university-engagement` | #79 | ✅ |
| `claude/university-engagement-web` | #80 | ✅ |
| `claude/university-explorer-3d` | #73 | ✅ |
| `claude/university-grow-console-m0f3qs` | #6 | ✅ |
| `claude/university-learner-model` | #81 | ✅ |
| `claude/university-learner-web` | #91 | ✅ |
| `claude/university-master-grower` | #77 | ✅ |
| `claude/university-phase2-ledger` | #76 | ✅ |
| `claude/university-phase4-ledger` | #78 | ✅ |
| `claude/university-professor-video` | #75 | ✅ |
| `claude/university-roadmap` | #90 | ✅ |
| `claude/university-skills-graph` | #86 | ✅ |
| `claude/university-speaks` | #95 | ✅ |
| `claude/verify-update-status-nyndvl` | #36 | ✅ |
| `claude/version-2.0.5` | #41 | ✅ |
| `claude/website-content-audit-k8jc9d` | #22 | ✅ |
| `claude/3d-engine-plant-strategy-vmrmnn` | #100 | ✅ |
| `design/chamber-glow-layer` | #124 | ✅ |
| `design/chamber-mockup-plant-visuals` | #115 | ✅ |
| `design/cola-construction-structure` | #125 | ✅ |
| `design/cola-phyllotaxis-stacking` | #127 | ✅ |
| `design/grow-chamber-hud-boosts-insights` | #114 | ✅ |
| `design/lab-3d-reference-note` | #128 | ✅ |
| `design/main-page-game-hub` | #118 | ✅ |
| `design/plant-mockup-round2` | #116 | ✅ |
| `design/plant-mockup-round3` | #117 | ✅ |
| `design/rendering-architecture-research` | #134 | ✅ |
| `fix/dedupe-boost-tray` | #126 | ✅ |
| `fix/mint-metadata-server-truth` | #122 | ✅ |

---

## CLOSED WITHOUT MERGE — content superseded by later work (14)

These PRs were closed intentionally; the work was either redone in a later PR that merged, or
the approach was abandoned. No content is uniquely lost.

| Branch | PR | Closed reason |
|---|---|---|
| `claude/activate-root-ci` | #21 | CI was activated via a different approach later |
| `claude/chamber-glow-phase2` | #129 | Superseded by `design/chamber-glow-layer` (PR #124 ✅) |
| `claude/chamber-sugar-leaf-sepals` | #130 | Absorbed into `claude/plant-round8-combined` (PR #133 ✅) |
| `claude/economy-readiness-audit-1gr574` | #10 | Economy audit approach revised; later PRs address gaps |
| `claude/fix-alembic-double-merge-head` | #11 | Alembic merge-head resolved via a different commit |
| `claude/plant-scouts-live-2a` | #19 | Phase 2A scouts superseded by later AI advisor work |
| `claude/repo-state-clarification-4ojv82` | #61 | Navigation wiring was completed in a later PR |
| `claude/trichome-frost-density` | #132 | Absorbed into `claude/plant-round8-combined` (PR #133 ✅) |
| `claude/wo3-stale-docs` | #103 | Memory layer was refreshed in subsequent sessions |
| `design/cola-construction-layers` | #123 | Superseded by `design/cola-construction-structure` (PR #125 ✅) |
| `design/plant-mockup-round4` | #119 | Plant visual iterations: rounds 7/8 supersede rounds 4–6 |
| `design/plant-mockup-round5` | #120 | Same as above |
| `design/plant-mockup-round6` | #121 | Same as above |
| `claude/pistil-hairs-round8` | #131 | Absorbed into `claude/plant-round8-combined` (PR #133 ✅) |

---

## CLOSED WITHOUT MERGE — **CONTENT NOT IN MAIN** (1 — requires owner decision)

### `claude/chamber-round8-furrier-pistils-denser-frost` — PR #136

**Status:** Draft PR, closed without merge. **Content is NOT present on `main`.**

**What the branch adds (383 additions, 28 deletions across 3 files):**
- `web/src/lib/chamber/stamps.ts` *(new file)* — offscreen canvas sprite cache that pre-renders
  pistil-filament and frost-glint sprites once and `drawImage`-blits them per tick instead of
  re-stroking paths each frame. Includes a Perlin-ish `makeFlowField` for coherent pistil
  direction. Performance-oriented change.
- `web/src/lib/chamber/chamberCore.ts` — pistil length boosted 0.24→0.4, denser frost pool,
  flow-field-oriented filaments for more natural "furry" hair look.

**Why it was held:** the PR was marked "Draft — do not merge. Owner will re-verify with their
own screenshots and integrate." The visual direction may require owner sign-off before shipping.

**Owner options:**
1. **Bring forward** — rebase/cherry-pick the branch onto current `main` and merge (new PR).
2. **Keep on ice** — leave the branch as a reference; do not delete it.
3. **Drop** — if the pistil look in PR #133 is satisfactory, discard and delete the branch.

Comment was posted on PR #136 (2026-07-03) pointing to this document.

---

## NO PR — orphaned stubs (7)

These branches were created but never had a PR opened (or their PR predates our audit window).
None of them are `--merged origin/main` per git, but their work is likely either superseded
or was exploratory. Safe to delete after a quick owner glance.

| Branch | Notes |
|---|---|
| `claude/deploy-config` | Early deploy config work; superseded by `claude/integrate-deploy-config` (PR #31 ✅) |
| `claude/economy-readiness-audit-ifuc7k` | Variant economy audit stub; no PR opened |
| `claude/guide-and-branding` | Early branding work; content unknown; likely superseded |
| `claude/local-demo` | Early local demo; superseded by `claude/integrate-local-demo` (PR #30 ✅) |
| `claude/onboarding` | Early onboarding stub; superseded by `claude/integrate-onboarding` (PR #29 ✅) |
| `claude/onboarding-deep` | Deep-onboarding variant; no PR; likely superseded |
| `claude/qa-testing-loop` | QA test-loop exploration; no PR; likely abandoned |

---

## CURRENT WORKING BRANCH (1)

| Branch | PR | Status |
|---|---|---|
| `claude/research-pr-review-1whd6v` | #137 (merged) | Active session branch — rebased to `main` post-merge; new PRs open from here |

---

## How to bulk-delete merged branches (owner action)

GitHub UI: go to `https://github.com/KudbeeZero/mainnet-growverse-v2.0/branches` →
filter by "Stale" or "All" → select merged branches → delete. This is the fastest path.

Alternatively, from any machine with write access:
```bash
git fetch --prune
# Preview what would be deleted:
git branch -r --merged origin/main | grep -v 'HEAD\|main\|research-pr-review' | sed 's|origin/||'
# Delete each:
git push origin --delete <branch-name>
```
Do NOT delete `claude/research-pr-review-1whd6v` (active session) or `claude/chamber-round8-furrier-pistils-denser-frost` (pending owner decision on PR #136).
