# 📍 Project Status & Forward Roadmap (condensed — adopted 2026-08-24)

> **Single source of truth for "where are we / what's next."** Merges the 90-day owner plan
> (ROADMAP_90D_2026Q3), the 22-phase GrowVerse arc, and this session's shipped work into one
> followable path. The older docs (ROADMAP_90D, GROWVERSE_ROADMAP, EXECUTION_MACHINE) are
> historical context — this doc supersedes them for sequencing.

---

## 1. File status (remote ↔ local)

**Repo:** `KudbeeZero/mainnet-growverse-v2.0.git` · **Branch:** `session/agent_ea83c9aa-…`
**Sync state (verified 2026-08-24):** branch is **up to date with origin** — every commit below is
pushed, `git status` clean, zero unpushed commits. GitHub shows the same diff as this tree.

### Shipped this session (committed + pushed, on the branch)
| Area | Files | Maps to roadmap |
|---|---|---|
| Plant lifecycle viz | `web/src/components/plant/GrowthJourney.tsx`, `web/src/app/dashboard/plants/[plantId]/page.tsx` | off-roadmap feature |
| 3D plant viewer | `web/src/components/viz/PlantViewerModal.tsx`, `web/src/app/.../chamber/page.tsx` | off-roadmap feature |
| NFT Lifecycle Center | `web/src/app/nft-center/page.tsx`, `web/src/components/nft/LifecycleMap.tsx`, `navLinks.ts` | p07 adjacent |
| Mint-path unification | `src/growpodempire/api/game_api.py` (mint_harvest → NFTMintService) | **o04/w5 cure-mint** |
| HarvestsPanel flow | `web/src/components/harvest/HarvestsPanel.tsx` | o04 adjacent |
| Curing vault polish | `web/src/components/nft/CuringRoom.tsx` | o04/p07 adjacent |
| Breeding depth | `api/game_api.py` (breeding_lab flag), `web/src/lib/features.ts`, `web/src/app/lab/breed/page.tsx`, `web/src/lib/types.ts`, `web/src/app/lab/page.tsx` | **p09 genetics UI** |
| University | verified complete, `university` flag enforced | p06 |

### Remote branches of note
- `origin/main` — default, green
- `origin/claude/paul-testing-prep-xk78mz` — merged (PR #14), the "Paul request" ✅
- `origin/claude/chamber-branchlet-zorder` — **other cloud agent's active branch** (chamber branchlet z-order + plant-view gate). Do not touch; it owns `chamberCore.ts` and the chamber page.
- `origin/design/main-page-game-hub` — design fork

---

## 2. What's DONE (official roadmap + this session)

| Roadmap item | Status |
|---|---|
| **w1 store correctness** (gv-o01, PR #171) | ✅ merged |
| **w2–3 equipment sim effects** (gv-o02, PR #172) | ✅ merged |
| **w4 pod equipment visuals** (gv-o03, PR #173) | ✅ merged |
| **w4b pod button fixes** (gv-o03b, PR #174) | ✅ merged |
| **p01 Architecture Truth** | ✅ merged |
| **Breeding flag gating** (BACKLOG #4 partial) | ✅ done this session |
| **Mint-path unification** (o04 C5/C6/C9 partial) | ✅ done this session |
| **Curing vault + NFT center UX** | ✅ done this session |
| **Plant lifecycle + 3D viz** (off-roadmap) | ✅ done this session |

---

## 3. Forward path (condensed, in build order)

These are the next branches, in order. **One branch at a time, from fresh main, each through
build → gates → verify → closeout → one draft PR.** Owner-decision gates (D2/D3) block #1.

| # | Branch | Title | Delivers | Blocks / Owner gates |
|---|---|---|---|---|
| **1** | `claude/gv-o04-cure-mint-integrity` | fix(mint): cure/mint state machine can't strand, lie, or pay zero | PENDING self-heal on retry (C6); mid-cure mint block (C5/D4); friendly no-wallet CTA (C9); backend tests for every seam | **D2** staking-reward formula · **D3** cure clock → owner must decide before code |
| **2** | `claude/gv-o05-wallet-claim-unification` | fix(wallet): one wallet stack, honest CTAs | One challenge/sign/link stack; retire ChainRow dead-end; honest TokenClaimBanner | **D5** staking-surface rename |
| **3** | `claude/gv-o06a-wallet-preview-watcher` | feat(wallet): preview-before-sign + txn watcher | WalletConnect polish, preview modal, txn_log, watcher chips | Protected-surface gate |
| **4** | `claude/gv-o06b-seed-nft-claim` | feat(chain): player seed-NFT claim on testnet | Port seed-ASA mint; single NFTAsset registry; claim ceremony | Owner testnet click-test |
| **5** | `claude/gv-p02-game-loop-codex` | feat(telemetry): loop codex + events | In-txn telemetry for gear/claim/cure/mint | — |
| **6** | `claude/gv-p03-pod-visual-moods` | feat(chamber): moods + rarity aura | Animated moods, mutation markers, goldens | — |
| **7** | `claude/gv-p05-scout-reports-slice1` | feat(scout): equipment-aware advice | Scout pipeline + card, store-mappable recommendations | — |
| **8** | `claude/gv-o07-flags-e2e-hardening` | fix(flags): 5 no-op flags actually gate + full-loop e2e | BACKLOG #4/#5 closeout; Playwright buy→plant→equip→harvest→cure→mint→claim | **D9** flag semantics |

**After #8** the arc resumes in GrowVerse order: p05 slice 2 → p08 economy v1 → p09 genetics UI
(remaining) → p10 missions → … → p22 beta hardening. (Full absorption register lives in
ROADMAP_90D_2026Q3.md §8 — not repeated here.)

---

## 4. Owner decision gates (must unblock before the branch starts)

| Gate | Decision | Blocks |
|---|---|---|
| **D2** | Approve staking reward = appraised value × `reward_pct` (and the pct) | #1 (o04) |
| **D3** | Confirm cure clock → player-effective (turbo) clock with wall-clock floor | #1 (o04) |
| **D5** | Pick the staking-surface rename | #2 (o05) |
| **D9** | Confirm intended semantics of the 5 no-op flags | #8 (o07) |

Record each in `docs/memory/DECISIONS.md` when made.

---

## 5. Standing rules (unchanged)

- One branch/PR at a time, from fresh `main`, named exactly as above.
- Protected surfaces (`chain/`, migrations, `balance.yaml` numbers, wallet UI, auth, lockfiles) →
  Security-Reviewer checklist + owner sign-off in the PR body (BUILD_RULES.md).
- CI keyless (mock provider). `main` must stay green — fixing a red main preempts all roadmap work.
- End every session: gates green → verify e2e → closeout → pointer + BACKLOG updated → exactly one
  draft PR → **pushed** (remote ≡ local).
