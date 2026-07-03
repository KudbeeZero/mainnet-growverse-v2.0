# Incidents & recurring-problems ledger (the "twice rule")

> **Owner directive (2026-07-02):** *if you ever run into the same problem two times then it
> needs to be fixed* — permanently, at the root. This file is where that happens. Every session
> that hits a problem checks here first; every problem seen a **second** time gets a root-cause
> fix recorded here (not another workaround). Sessions append; entries are never silently
> deleted — mark them RESOLVED with the fix and date.

Status legend: 🔴 open · 🟡 fix in flight · ✅ resolved (root cause fixed, dated)

## Ledger

### ✅ Production deploy drift (API weeks behind the repo)
- **Symptom:** live `growverse-api.fly.dev` ran pre-June-25 code while ~35 PRs merged; nobody
  noticed until an ElevenLabs verification (2026-07-02).
- **Root cause:** deploys were manual (`fly deploy` from a desktop); nothing deployed on merge.
- **Permanent fix (2026-07-02):** `.github/workflows/deploy-api.yml` auto-deploys `growpod/` to
  Fly on every merge to `main` that touches the backend (needs the `FLY_API_TOKEN` repo secret,
  set 2026-07-02). Never rely on someone remembering to deploy.

### 🟡 Deploy 502 — untested boot guard reached production (rate-limit / Redis)
- **Symptom:** first auto-deploy (2026-07-02) replaced the healthy machine with one whose
  workers died on boot → API down, 502s.
- **Root cause:** the fail-closed rate-limit guard (`api/ratelimit.py`, added 2026-06-20)
  refuses to boot with `APP_ENV=production` + `memory://` storage; no Redis was attached; the
  guard had **zero test coverage** and had never been exercised against the real deploy config.
- **Fix in flight (PR #105):** `RATELIMIT_ALLOW_MEMORY=true` explicit acknowledgment (loudly
  logged, keeps per-worker limits) + `growpod/fly.toml` sets it TEMPORARILY + 3 regression
  tests pinning all guard arms.
- **Rule extracted:** any fail-closed / boot-time guard ships WITH tests for both arms and a
  note in the deploy runbook; config guards must be validated against the real `fly.toml` env.
- **Remaining owner step:** attach Redis (`fly redis create` or Upstash in the Fly dashboard),
  set `RATELIMIT_STORAGE_URI` secret, delete the `RATELIMIT_ALLOW_MEMORY` line from fly.toml.

### ✅ Backlog went stale while code shipped (3 weeks unreconciled)
- **Root cause:** reconciliation was prose guidance, not enforced.
- **Permanent fix (2026-07-02):** `make check-memory` (and CI) fails when `BACKLOG.md`'s
  `Last reconciled` marker falls >14 days behind the HEAD commit date; closeout/handoff-audit
  skills + CLAUDE.md updated.

### 🔴 Branch accumulation — 108 remote branches, almost all merged claude/* session branches
- **Symptom:** merged one-session branches pile up forever and resurface in every branch list.
- **Root cause:** GitHub is not deleting head branches on merge, and agents are forbidden from
  branch deletion (`.claude/settings.json` denies it — deliberate safety rail; keep it).
- **Permanent fix (OWNER, one tap, works from a phone browser):** GitHub → repo →
  **Settings → General → Pull Requests → ✅ "Automatically delete head branches."**
  From then on every merged PR cleans up its own branch.
- **Backlog sweep (optional, after the toggle):** the ~100 existing merged branches can be
  bulk-deleted from GitHub's Branches page ("stale" tab) whenever convenient — each shows a
  delete button; no desktop tooling required. Do NOT delete: `main`, any branch with an open
  PR, `backup/local-changes-2026-06-18` (owner's backup — owner decides).
- **Agent rule:** never reuse a merged branch's history; restart the branch from `origin/main`
  (same name is fine) — force-with-lease only over already-merged history.

### ✅ One session branch forced to carry unrelated PRs (mixed-purpose PR #104)
- **Symptom:** security review + grow-room revert + HERMES University landed in one PR because
  the session may push only to its single designated branch, colliding with "one PR = one
  purpose".
- **Resolution (2026-07-02):** acceptable pattern documented — one commit per purpose, PR body
  declares each unit separately; after a merge, the branch restarts from `origin/main` and the
  next purpose gets its own PR (as PR #105 did). If this bites again, ask the platform owner
  for multi-branch sessions; do not stack unmerged purposes.

### ✅ `frontiernext` Fly app confusion (root `fly.toml`)
- **Symptom:** repeated confusion over which Fly app serves the game API; root `fly.toml`
  describes `frontiernext` as the API for `api.frontierprotocol.app`, but the real game API is
  `growverse-api` (per `docs/DEPLOY_FLY.md`: frontiernext is an older Node/Drizzle
  plant-minting service).
- **Resolution:** recorded here (2026-07-02) — **`growverse-api` is the game API**;
  growverse.dev proxies `/api/*` to it. Treat root `fly.toml` as the OTHER service's config;
  candidate for retirement in the dormant-investments sweep (BACKLOG REC-005).

### ✅ Subagent runs dying with "API Error: 529 Overloaded"
- **Symptom (seen repeatedly, 2026-07-02):** background review agents die mid-run with 529s.
- **Handling that works:** resume the same agent (context survives); after ~3 failures, do the
  work inline in the main session instead of spawning. If a whole day is 529-heavy, batch work
  into fewer, bigger agent prompts.

### ✅ Provider 400s on model-capability mismatch (adaptive thinking × Haiku)
- **Symptom (live, 2026-07-02):** with `ADVISOR_MODEL=claude-haiku-4-5`, every Professor lecture
  failed 503 — the API rejected the hardcoded `thinking={"type": "adaptive"}` ("adaptive thinking
  is not supported on this model"). The advisor had the same latent bug.
- **Root cause:** provider calls assumed a capability of the default big model; nothing degraded
  when the operator picked a cheaper model.
- **Permanent fix (2026-07-02):** `ai/anthropic_compat.parse_preferring_thinking` — try with
  thinking, retry once without when the API says unsupported; both providers use it; regression
  tests pin the fallback. **Rule:** provider calls must degrade on capability 400s, never assume
  the default model's features.

### ✅ `/plants/:id/events` mock returned the plants LIST, crashing EventLog (pod-cleanup-shot)
- **Symptom:** `e2e/pod-cleanup-shot.spec.ts › a harvested plant's detail page …` timed out
  waiting for the "Clean & recycle pod" button — first seen locally, then again in real CI on
  PR #137 (`06c0e7c`), both the attempt and the CI retry. First guess was CI parallel-worker
  contention (2-core runner, shared `next start`) and the fix was a widened assertion timeout —
  **that guess was wrong**: bumping to 20s locally still failed every time, 100% reproducible,
  which is the signature of a real bug, not a flake.
- **Root cause:** `e2e/fixtures/mockGame.ts`'s route matcher does `path.includes(needle)` over
  the `overrides` map. `/plants/plant1/events` (used by `usePlantState`'s sibling events query)
  has no explicit entry, so it substring-matches the `"/plants"` fallback and gets back the
  **plants list** instead of an events array. `EventLog` then maps that list and calls
  `titleCase(e.event_type)` on plant objects that have no `event_type` field →
  `TypeError: Cannot read properties of undefined (reading 'replace')` → Next.js's client-side
  exception boundary replaces the whole page with "Application error", so no button of any kind
  is ever visible — explaining why it failed even at 20s.
- **Permanent fix (2026-07-03):** added an explicit `"/plants/plant1/events": []` entry to
  `mockGame.ts`'s default overrides (sorted before the shorter `"/plants"` needle either way, but
  now present so it doesn't need to fall through). Reverted the timeout bump — it was masking
  nothing and the real fix makes the test pass instantly again. **Rule extracted:** when a
  substring-matching mock fixture adds a new API route, check whether an existing broader needle
  (e.g. `/plants`) already unintentionally shadows it — and when a "flaky" test fails at 2x the
  original timeout too, stop widening timeouts and look for `page.on("pageerror")` output first;
  a deterministic client-side exception reads exactly like a timeout from the assertion's side.

## The rule, restated

1. Hit a problem? **Check this ledger first** — if it's here, apply the recorded fix, don't
   re-derive it.
2. Solved something the hard way? **Add an entry** (symptom → root cause → permanent fix).
3. Same problem **twice** without a root-cause fix = stop and fix the root cause now, or
   escalate to the owner that the approach (or the model driving it) needs to change.
