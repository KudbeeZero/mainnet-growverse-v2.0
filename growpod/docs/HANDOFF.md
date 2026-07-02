# HANDOFF — the baton

> Single source of truth for **what the next chat does first**. Rewritten by `/closeout` at
> the end of every chat; read by `/handoff-audit` at the start of the next. If this file and
> the code disagree, the code wins — fix the baton. See `docs/SESSION_PROTOCOL.md`.

**Last rewritten:** 2026-07-02 · **By:** the handoff-audit session (baton catch-up + Blue Dream
round 4; see `docs/audits/PR-110-global-learning-memory-blue-dream-r3.md` for the catch-up audit).
**Active branch:** `claude/project-onboarding-review-vpx0aj` — open PR awaiting owner review/audit.
**`main`:** PR #110 merge — CI green (backend + web checks both `success`); this session's PR not
yet merged.
**Production:** `growverse-api` on Fly is LIVE on current code (verified 2026-07-02: bio-101 +
factions flag present, `/health` OK, lecture audio cache-hit **and** the Haiku adaptive-thinking
fallback is live — see Incident below). Deploys are AUTOMATIC on merge
(`.github/workflows/deploy-api.yml` at the repo root). growverse.dev (Vercel) deploys `web/`
from `main`.

> **Owner rule in force: ONE active PR at a time.** Queue further units here, don't open them.

---

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

**Owner is choosing the next backlog unit this session** (options on the table: Blue Dream
round 4 renderer polish per the owner's reaction to round 3; the HERMES University wiring
audit; the security follow-ups queued from PR #104; or Global Learning Memory design/11 P1
build). Whichever is picked, scope it to the backlog's stated bounds before writing code — see
`docs/memory/BACKLOG.md` for each item's detail. Off-limits unless separately approved: economy
values, treasury paths, settlement deposit/withdraw.

## Verification split

- **Agent-verified (test-backed, this session):** `make lint` clean, `make check-memory` green
  (33 files), web `typecheck`/`lint` clean on a fresh `npm ci`; backend `make test` re-run in
  progress (results pending at time of this baton rewrite — confirm before trusting a red/green
  claim beyond PR #110's own CI, which was green: backend + web jobs both `success`).
- **Device-verify (owner):** growverse.dev in a browser — grow room shows the procedural
  plant; HERMES catalog renders school sections; lecture audio plays; Blue Dream round 3 render
  reaction (round 4 go/no-go). Optional one-tap: GitHub → Settings → "Automatically delete head
  branches" (INCIDENTS.md branch entry).

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
