# HANDOFF — the baton

> Single source of truth for **what the next chat does first**. Rewritten by `/closeout` at
> the end of every chat; read by `/handoff-audit` at the start of the next. If this file and
> the code disagree, the code wins — fix the baton. See `docs/SESSION_PROTOCOL.md`.

**Last rewritten:** 2026-07-03 · **By:** the PR #137 session (multi-slice hardening + feature batch).
**Active branch:** `claude/research-pr-review-1whd6v` — **open PR #137**, CI green on each push.
**`main`:** unchanged this session (all work is on #137, not yet merged).
**Production:** `growverse-api` on Fly is LIVE on current code (verified 2026-07-02: bio-101 +
factions flag present, `/health` OK, lecture audio cache-hit **and** the Haiku adaptive-thinking
fallback is live — see Incident below). Deploys are AUTOMATIC on merge
(`.github/workflows/deploy-api.yml` at the repo root). growverse.dev (Vercel) deploys `web/`
from `main`.

> **Owner rule in force: ONE active PR at a time.** Queue further units here, don't open them.

---

## What shipped 2026-07-03 (PR #137, this session — all on one branch)

A large hardening + feature batch (all gate-green, CI green each push):
1. **Whole-web crash hardening** — a route-wide client-exception sweep found the
   "unexpected API shape white-screens the page" class in 5 pages (`/university`,
   `/lab/strains/[id]`, `/university/learner`, `/admin/economy`, plus the
   `/plants/:id/events` fixture crash). All fixed with shape guards; locked in by
   a permanent `web/e2e/route-crash-sweep.spec.ts` (29 routes, 0 crashes now).
2. **Mobile** — fixed the chamber HUD CO₂ chip clipping off a 390px screen
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
8. **Blue Dream pilot, rounds 1–3 (PRs #108–#110)** — one strain, authored end-to-end against an
   owner reference photo: round 1 identity (new blue-teal palette family, BudDNA, silhouette),
   round 2 renderer realism (de-grape, cola proportion cap, leaf naturalism, connectivity),
   round 3 smoothing (closed midpoint-quadratic spline bud-mass silhouette, node-leaf-driven
   lower-canopy "skirt"). Template intended to roll out to the other 28 strains once approved.
9. **Design Codex 11 (PR #110)** — `docs/memory/design/11-global-learning-memory.md`: spec for
   per-player personalization + a global, append-only, anonymized-on-read knowledge layer so
   the AI teacher gets smarter from every player. 4 additive phases (Capture → Personal →
   Retrieve → Insights). Registered in `MAP.md`; **not built yet** (design only).

## NEXT ACTION (single)

**Two owner-directed threads are open on #137 and need a decision or a build:**
1. **Onboarding rework (owner, 2026-07-03):** "it's too long, not exciting, doesn't really work —
   set up some sort of onboarding with AI helping along the way." The AI advisor (Master Grower)
   already exists on the dashboard, plant detail, FTUE (per-step coaching) and University — it's
   wired, just not prominent, and needs the advisor key in prod. Current onboarding = a 4-beat
   cinematic landing (`/onboarding`) + a 7-step FTUE (`/ftue`). Needs a shorter, AI-guided
   first-run — scope/taste to confirm with owner before a big rebuild.
2. **Plant render:** owner says it's not 10/10 (honest self-score ~8). It's under the owner's own
   "don't chase the macro bud" freeze — needs the owner to name the specific gap (or lift the
   freeze) before a targeted 2D-chamber round.

Also queued (owner-gated): the 🔴 security launch-blockers (PR #104), gear→sim wiring, economy
values. Off-limits unless separately approved: economy values, treasury paths, settlement
deposit/withdraw.

## Verification split

- **Agent-verified (test-backed, this session):** web `typecheck`/`lint` clean, `vitest` 480
  passing (54 files), `next build` clean, Playwright e2e 53 passing (2 skipped) incl. the new
  route-crash net; `make check-memory` green (34 files). Every #137 push's CI (backend + web
  jobs) came back `success`.
- **Device-verify (owner):** growverse.dev in a browser — the store's new panel look; a harvested
  pod's Clean & recycle; owned consumables appearing under a plant's Care as "Items"; the mobile
  chamber HUD (all 4 stat chips on-screen at phone width); and the plant render (the 10/10 call).

## OPEN RISKS (carried)

- **Rate limits are per-worker in-memory in prod** (`RATELIMIT_ALLOW_MEMORY=true` in
  `fly.toml`) until Redis is attached (`fly redis create` → `RATELIMIT_STORAGE_URI` secret →
  delete the override line). INCIDENTS.md tracks it (🟡).
- **Settlement deposit disabled off-mock** (fail-closed) pending the player-signed,
  indexer-verified redesign; withdraw lacks an idempotency key. Treasury — owner gate.
- **5 no-op feature flags + web never reads `/flags`** (false kill switches) — BACKLOG REC-005.
- **No automated DB backups** (SECURITY.md corrected; snapshot workflow still to build).
- **Docs hygiene tail** (BUILDLOG, frozen "Live" ledgers, DEV_BUILD_LOG, 00–09 snapshots) —
  `docs/memory/DOCS_INDEX.md` stale ledger + BACKLOG item.
