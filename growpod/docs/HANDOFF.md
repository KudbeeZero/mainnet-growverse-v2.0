# HANDOFF — the baton

> Single source of truth for **what the next chat does first**. Rewritten by `/closeout` at
> the end of every chat; read by `/handoff-audit` at the start of the next. If this file and
> the code disagree, the code wins — fix the baton. See `docs/SESSION_PROTOCOL.md`.

**Last rewritten:** 2026-07-06 · **By:** the session-freeze-investigation session (GitHub status
check + CI regression fix + owner-mockup chamber redesign). This baton had gone stale — it still
described PR #137 as open 3 days after it merged, and never logged the ~19 PRs (#138–#156) that
shipped in between. Corrected below.
**Active branch:** `claude/session-freeze-investigation-ouw47a` — **open PR #159** (the chamber
redesign; the branch was restarted from `main` after its prior fix PR #158 merged). PR #158 (CI
fix) and PR #157 (GrowVerse roadmap docs) are both **merged**.
**NEXT CHAT STARTS HERE:** when the owner says "go" on the roadmap, the first build branch is
`claude/gv-p02-game-loop-codex` (Phase 2). Read `docs/memory/EXECUTION_MACHINE.md` — its "Current
Position" block is the live next-branch pointer; `docs/memory/GROWVERSE_ROADMAP.md` has the full
22-phase plan; `docs/memory/ARCHITECTURE_TRUTH.md` is the verified baseline. Build one
`claude/gv-pNN-slug` branch at a time.
**Chamber-mockup decision — RESOLVED (owner, 2026-07-06):** the owner chose to **replace** the
chamber layout with the mockups (not layer on top), and keep the Pod Visual System (moods/rarity)
as roadmap Phase 3. Built in PR #159: a default **GROW hub tab** (Today's Plan + Plant Insights +
Progress + boosts on the chamber), a portrait bottom-sheet **chevron** pop-up/down, and a
**phone-landscape slide-out HUD** system (left = controls, right = insights, auto-compact). This
reverses the earlier "panels only on /dashboard" split — `care-loop-shot.spec.ts` was updated to
assert the GROW hub, and `chamber-landscape-hud-shot.spec.ts` proves the HUD flow.
**`main`:** includes PR #157 (roadmap docs) + PR #158 (e2e testid fix) on top of everything
through #156. **Note:** `main`'s HANDOFF.md was briefly double-base64-encoded by a bad
`create_or_update_file` call; PR #159 restores it to plain markdown (this file).
**Production:** `growverse-api` on Fly is LIVE (verified 2026-07-02: bio-101 + factions flag
present, `/health` OK, lecture audio cache-hit and the Haiku adaptive-thinking fallback live — see
Incident below). Deploys are AUTOMATIC on merge (`.github/workflows/deploy-api.yml` at repo root).
growverse.dev (Vercel) deploys `web/` from `main`.

> **Owner rule in force: ONE active PR at a time.** Queue further units here, don't open them.

---

## What shipped 2026-07-06 (this session — status check + CI fix, PR #158)

Owner asked for a GitHub status check + a review pass + a roadmap look. Found:
1. **The baton was 3 days / ~19 PRs stale** (see below) — corrected in this rewrite.
2. **`main`'s web CI was red**: `528c6cd` ("remove arcade tab, consolidate store panels into
   toolbar," part of #156) folded the chamber's ARCADE tab into the default CLIMATE tab — a
   legitimate UX simplification — but dropped `data-testid="growth-boost"` when the button moved
   into the new `ArcadeToolbar.tsx`, and left 3 e2e specs asserting on the removed tab
   (`care-loop-shot`, `dedupe-boost-tray-shot` ×2, `growth-boost-shot`). Root-caused, fixed, and
   merged as **PR #158**: testid restored, stale `/ARCADE/i` tab assertion replaced with a direct
   check of the always-visible toolbar. Full web gate re-verified green (tsc, lint, vitest 487/487,
   build, Playwright 55/55).
3. Reviewed **PR #157** (GrowVerse roadmap docs, still open) and read both roadmaps — see NEXT
   ACTION below.

## What shipped 2026-07-05 (PRs #138–#156, previous session — never logged in the prior baton)

A full day's work that the stale baton skipped entirely:
- **Infra audit (#148)**: migration↔model drift (4 tables only existed via `create_all`) fixed
  with a catch-up migration + a permanent `alembic check` CI gate; implicit treasury ASA
  auto-create now fails closed; 4 more MEDIUM fixes (genesis-ID guard, `pool_pre_ping`, contract-
  expiry persistence, `MAX_WITHDRAWAL_PER_DAY` fail-closed default).
- **Idempotency-Key infrastructure + care-streak/resin-score (#149)**: `Idempotency-Key` header
  dedup on 18 mutation endpoints; `care_streak`/`resin_score` computed server-side, surfaced in
  Plant Insights.
- **Security races (#144)**: closed withdraw double-payout and mint double-mint races.
- **Purchase-flow bugfixes (#145, #146)**: harvest no longer force-sells (cure/mint/Enter-Cup stay
  reachable); store/lab/market bugs found by playtest.
- **Chamber round 10 (#142)**: pod shape variety, size/lightness rebalance, branch/leaf color
  separation.
- **Store→Chamber integration (#153, #154, #155)**: gear/consumables/bundles/partner panels wired
  into the chamber's arcade area; a dev-only blockchain testing console at `/dev/blockchain`.
- **Arcade polish rounds (#150 merged; #151, #152 still open drafts based on a stale `main` commit
  — their content is superseded by what actually shipped; recommend closing both, no unique value
  left unmerged.)**
- **UI professionalization + arcade-tab consolidation (#156)**: button touch-target/focus-ring
  audit fixes; folded the chamber's ARCADE tab into CLIMATE (see the CI regression this caused,
  fixed above in #158).

## What shipped 2026-07-03 (PR #137)

A large hardening + feature batch (all gate-green, CI green each push):
1. **Whole-web crash hardening** — a route-wide client-exception sweep found the
   "unexpected API shape white-screens the page" class in 5 pages (`/university`,
   `/lab/strains/[id]`, `/university/learner`, `/admin/economy`, plus the
   `/plants/:id/events` fixture crash. All fixed with shape guards; locked in by
   a permanent `web/e2e/route-crash-sweep.spec.ts` (29 routes, 0 crashes now).
2. **Mobile** — fixed the chamber HUD CB₂ chip clipping off a 390px screen
   (the "text off the screen" report); verified overflow clean across all routes.
3. **React #418** hydration errors (every page) fixed at the footer build-stamp.
4. **Store** — panelized/tiled look (owner request) + fixed a bogus "undefined —
   Seasonal genetics" card.
5. **Consumables "use item"** wired — owned consumables are finally usable on a
   plant (`POST .../apply`), the missing half of the store loop. No ledger touch.
6. **Pod-recycle + particle fixes** (earlier in the session, see BACKLOG).
7. **Memory/process** — resolved committed git conflict markers in `BACKLOG.md`
   and added `check_memory.py` check #6 (conflict-marker gate); retired 12
   verified-dead web files (Command Center / FTUE supersessions); corrected a
   stale `/contracts` backlog claim; README + this baton refreshed.

## What shipped 2026-07-02 (PRs #104–#110)

1. **Security hardening** — waitlist PII/enumeration/DoS fixes, deposit fail-closed off-mock,
   401-only session death, root fly.toml `APP_ENV=production`, non-root Docker.
2. **Grow room reverted to the procedural plant** — photoreal stills deleted (ADR 2026-07-02).
3. **HERMES University** — mastery now credits completed courses (was dead for 14/15 courses);
   produce-once lecture audio (ElevenLabs billed once per course; verified live: cache-hit);
   difficulty picker removed; online-school catalog; codex doc `design/10-hermes-university.md`.
4. **Prod outage + restore** — the untested rate-limit boot guard 502'd the first auto-deploy
   (no Redis); fixed via acknowledged `RATELIMIT_ALLOW_MEMORY` + 3 guard tests (see
   `docs/memory/INCIDENTS.md`).
5. **Process enforcement** — backlog staleness gate in check-memory; INCIDENTS twice-rule
   ledger; `docs/memory/DOCS_INDEX.md` docs tracking layer + stale-doc corrections
   (DEPLOY_FLY, SECURITY.md backups, MASTER_BIBLE banner, licenses/buds notes).
6. **Real Claude Master Grower** — `ai/master_grower_claude.py` on `MASTER_GROWER_MODEL`
   (default Haiku 4.5, cheap); factory returns it with a key, mock in CI unchanged.
   Advisor/auto-care and the Professor lecturer already had real Claude providers.
7. **AI stack activated live (PR #107)** — owner set `ANTHROPIC_API_KEY` + `ADVISOR_MODEL` in
   Fly secrets; live traffic hit a real bug the mock never exercises: Haiku rejects the
   hardcoded `thinking:{"type":"adaptive"}` param (400), 503-ing every lecture. Fixed with
   `ai/anthropic_compat.parse_preferring_thinking` (retry once without thinking on a capability
   400); both the advisor and lecturer now use it. **The AI-stack rollout is done, not
   pending** — see `docs/memory/INCIDENTS.md` "Provider 400s on model-capability mismatch."
8. **Blue Dream pilot, rounds 1-3 (PRs #108–#110)** — one strain, authored end-to-end against an
   owner reference photo: round 1 identity (new blue-teal palette family, BudDNA, silhouette),
   round 2 renderer realism (de-grape, cola proportion cap, leaf naturalism, connectivity),
   round 3 smoothing (closed midpoint-quadratic spline bud-mass silhouette, node-leaf-driven
   lower-canopy "skirt"). Template intended to roll out to the other 28 strains once approved.
9. **Design Codex 11 (PR #110)** — `docs/memory/design/11-global-learning-memory.md`: spec for
   per-player personalization + a global, append-only, anonymized-on-read knowledge layer so
   the AI teacher gets smarter from every player. 4 additive phases (Capture → Personal →
   Retrieve → Insights). Registered in `MAP.md`; **not built yet** (design only).

## NEXT ACTION (single)

**Blocked on the owner's answer to the chamber-mockup reconciliation question above.** Once
answered, either: (a) build the mockup as the new chamber design (new branch, not a `gv-pNN`
phase — do it before or alongside Phase 3), or (b) proceed straight to
**`claude/gv-p02-game-loop-codex`** (Phase 2 of the GrowVerse roadmap — see
`docs/memory/EXECUTION_MACHINE.md`'s Current Position pointer) if the owner wants the mockup held
as reference only.

**Older owner-directed threads, still open, not gating anything (tracked in BACKLOG.md):**
1. **Onboarding rework (owner, 2026-07-03):** "it's too long, not exciting, doesn't really work —
   set up some sort of onboarding with AI helping along the way." The AI advisor (Master Grower)
   already exists on the dashboard, plant detail, FTUE (per-step coaching) and University — it's
   wired, just not prominent. Current onboarding = a 4-beat cinematic landing (`/onboarding`) + a
   7-step FTUE (`/ftue`). Overlaps GrowVerse Phase 18's onboarding-finish requirement.
2. **Plant render:** owner says it's not 10/10 (honest self-score ~8), under the owner's own
   "don't chase the macro bud" freeze — needs the owner to name the specific gap (or lift the
   freeze).
3. **Cleanup:** close stale draft PRs #151, #152 (arcade polish — superseded, no unique content).

Off-limits unless separately approved: economy values, treasury paths, settlement deposit/withdraw.

## Verification split

- **Agent-verified (test-backed, this session):** `main`'s web CI regression (dropped
  `growth-boost` testid) traced + fixed, PR #158 merged with tsc/lint/vitest 487/487/build/
  Playwright 55/55 all green. `python3 scripts/check_memory.py` OK.
- **Device-verify (owner):** the chamber-mockup reconciliation decision (above); growverse.dev
  spot-check that the ARCADE-tab-removal UX change (#156) still feels right now that its test
  coverage is restored.

## OPEN RISKS (carried)

- **Rate limits are per-worker in-memory in prod** (`RATELIMIT_ALLOW_MEMORY=true` in
  `fly.toml`) until Redis is attached (`fly redis create` → `RATELIMIT_STORAGE_URI` secret →
  delete the override line). INCIDENTS.md tracks it (🟡).
- **Settlement deposit disabled off-mock** (fail-closed) pending the player-signed,
  indexer-verified redesign; withdraw lacks a general idempotency key (endpoint-specific keys
  landed in #149; a fully general header is still `## 🟠 Medium` in BACKLOG).
- **5 no-op feature flags + web never reads `/flags`** (false kill switches) — BACKLOG REC-005.
- **No automated DB backups** (SECURITY.md corrected; snapshot workflow still to build).
- **Docs hygiene tail** (BUILDLOG, frozen "Live" ledgers, DEV_BUILD_LOG, 00–09 snapshots) —
  `docs/memory/DOCS_INDEX.md` stale ledger + BACKLOG item.
- **Two stale open draft PRs** (#151, #152) — superseded arcade-polish work, safe to close.
