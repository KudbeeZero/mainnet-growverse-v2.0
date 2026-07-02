# HANDOFF — the baton

> Single source of truth for **what the next chat does first**. Rewritten by `/closeout` at
> the end of every chat; read by `/handoff-audit` at the start of the next. If this file and
> the code disagree, the code wins — fix the baton. See `docs/SESSION_PROTOCOL.md`.

**Last rewritten:** 2026-07-02 · **By:** the security-review → HERMES → prod-restore session.
**Active branch:** `claude/code-review-security-vijkhs` (restarts from `origin/main` after each merge).
**`main`:** PR #105 merge + the docs/master-grower follow-up PR — CI green.
**Production:** `growverse-api` on Fly is LIVE on current code (verified 2026-07-02: bio-101 +
factions flag present, `/health` OK, lecture audio cache-hit). Deploys are AUTOMATIC on merge
(`.github/workflows/deploy-api.yml` at the repo root). growverse.dev (Vercel) deploys `web/`
from `main`.

> **Owner rule in force: ONE active PR at a time.** Queue further units here, don't open them.

---

## What shipped 2026-07-02 (PRs #104, #105 + follow-up)

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

## NEXT ACTION (single)

**AI-stack rollout on the small budget (~$13):** owner sets `ANTHROPIC_API_KEY` in Fly secrets
**plus** `ADVISOR_MODEL=claude-haiku-4-5-20251001` (advisor/lecturer default is Opus — too
expensive for the budget; the Master Grower already defaults to Haiku). Then verify:
`/master-grower/ask` returns `provider: claude:claude-haiku-...`, one lecture generates and
caches, spend shows a few cents. Config/env only — no code expected. Off-limits: economy
values, treasury paths.

## Verification split

- **Agent-verified (test-backed):** backend 1111 passed / 6 skipped; web 417 + typecheck/lint/
  build; check-memory green; live API probed (health / flags / catalog / audio-cache).
- **Device-verify (owner):** growverse.dev in a browser — grow room shows the procedural
  plant; HERMES catalog renders school sections; lecture audio plays. Optional one-tap:
  GitHub → Settings → "Automatically delete head branches" (INCIDENTS.md branch entry).

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
