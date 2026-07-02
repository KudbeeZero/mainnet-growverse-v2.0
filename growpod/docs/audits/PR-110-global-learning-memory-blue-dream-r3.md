# Audit — PR #110: docs(design/11) global learning memory spec + Blue Dream round 3

**Branch:** `claude/code-review-security-vijkhs` → `main` · **Head SHA:** `b790d3cf03eab4e8b443a1db65330800493bb72e` (base `3c6b7eee028eae1af5459fdde7897bd34d309768`, PR #109) · **Auditor run:** 2026-07-02
**CI on the PR:** not checked (no GitHub API access in this session — org has not connected the Claude GitHub App) · **Reviewer:** independent auditor (does not trust PR prose)

## 0. Baton staleness (docs/HANDOFF.md) — PRIMARY FINDING

`docs/HANDOFF.md` was last touched by PR #106 (`git diff 2e2addc..6acd1e6 -- docs/HANDOFF.md` shows the rewrite; `git diff 6acd1e6..b790d3c -- docs/HANDOFF.md` is **empty** — zero commits to the file across #107, #108, #109, #110). The baton is stale on every axis:

- **"What shipped" list** stops at item 6 (#106, Master Grower). #107 (adaptive-thinking fallback), #108/#109/#110 (Blue Dream rounds 1-3) and the design/11 global-learning-memory spec are entirely unlisted.
- **NEXT ACTION is already complete, not pending.** The current NEXT ACTION tells the owner to *set* `ANTHROPIC_API_KEY` + `ADVISOR_MODEL=claude-haiku-4-5-20251001` in Fly secrets and verify live Claude output. But PR #107's commit message (`8e2a0c6`) opens: *"Live incident (2026-07-02): with `ADVISOR_MODEL=claude-haiku-4-5` (set to fit the small API budget), every Professor lecture failed 503..."* — this is only possible if the key and `ADVISOR_MODEL` were **already live in production** before #107 shipped. `docs/memory/INCIDENTS.md` (diff `6acd1e6..8e2a0c6`) records the same incident and its fix (`ai/anthropic_compat.parse_preferring_thinking`, `ai/claude.py`, `ai/lecturer_claude.py`) as ✅ resolved. So the rollout the NEXT ACTION describes already happened; the baton is directing the next session to redo a completed step instead of pointing at the real next unit of work (e.g. starting design/11 P1, or the security-follow-ups list in BACKLOG.md).
- **OPEN RISKS section** never mentions Blue Dream (#108-#110) or design/11 — expected, since neither introduces a new risk, but the section is simply frozen at #106's language and was not re-examined.
- I could not independently confirm the literal phrase "Master Grower verified live on Haiku" (no GitHub API access to read the PR #107 body directly; the squash-merge commit message is the closest available artifact and does not contain that exact sentence — it discusses the lecturer/advisor bug, not Master Grower specifically, and notes "master_grower_claude already omitted thinking," i.e. Master Grower was never affected by this particular bug). The live-incident evidence above is nonetheless sufficient to show the NEXT ACTION's rollout step is done.

**Conclusion: the baton is stale.** It under-reports 4 merged PRs' worth of shipped work and its single NEXT ACTION describes a step that was already completed prior to/during PR #107.

## Claims vs. evidence
| # | PR claims | Verified? | Evidence (`file:line`) |
|---|-----------|-----------|------------------------|
| 1 | New doc `docs/memory/design/11-global-learning-memory.md` (personalization + global learning memory spec, 4-phase build order) | ✅ | File exists, 62 lines, `git diff 3c6b7ee..b790d3c --stat` shows it added; content matches (capture/personal/retrieve/insights phases at lines 27-53 of the file) |
| 2 | Registered in `docs/memory/MAP.md` | ✅ | `docs/memory/MAP.md` diff adds one row: `design/11-global-learning-memory.md \| ... ⬜ design (owner directive 2026-07-02); P1–P4 build order` |
| 3 | `docs/memory/BACKLOG.md` carries the track | ✅ | BACKLOG diff adds a 6-line 🏛️ ⬜ item referencing `docs/memory/design/11-global-learning-memory.md` |
| 4 | Blue Dream round 3: midpoint-quadratic closed spline replaces the round-2 unioned-ellipse bud-mass silhouette | ✅ | `growpod/web/src/lib/chamber/chamberCore.ts` — round-2 blob/ellipse code (`ctx!.ellipse(...)`) removed; replaced with vertex array `pts` + `ctx!.quadraticCurveTo(...)` loop building a closed spline through smoothed cluster envelope points (comment: "closed midpoint-quadratic spline... C1-smooth all the way round") |
| 5 | Skirt scaling law: broad-leaf strains (`nodeLeaf` ≳1.1) get a fuller lower canopy | ✅ | New `skirt` field on `Node` interface; `const skirt = low * clamp((SK.nodeLeaf - 1) / 0.2, 0, 1);` scales `leafSize`/`nodeLeafSize` and adds two extra shaded fans (`if (nd.skirt > 0.25) nodeFans.push(...)`) |
| 6 | "419/419 web tests" pass at the round-3 checkpoints | ⚠️ not re-verified | Claimed in commit body only (`b790d3c`'s 2nd/3rd/4th sub-commits: "419/419 web tests"); web `node_modules` absent in this environment, so the auditor could not re-run `npm test`/`typecheck`/`build` — see Gates section. Plausible: no test files touched in the diff, so a prior 419-count carrying forward unchanged is consistent, but not independently confirmed here. |
| 7 | `make check-memory` green, 33 files | ✅ | Re-ran locally: `Memory integrity OK — 33 files, links + ✅ citations resolve.` — exact figure matches |

## Gates re-run by the auditor
- `make test` (backend, with coverage) → **not confirmed**. Ran in background (`.venv` built via `make setup`); the pytest process (~4+ min elapsed) produced an empty output file and no `.coverage` artifact when the auditor was told to wrap up. Deprioritized per instruction rather than continuing to wait. Not scored PASS or FAIL — treat as **not run to completion**.
- `make lint` → **PASS** — `ruff check --select=E9,F63,F7,F82 src tests` → "All checks passed!"
- `make check-memory` → **PASS** — "Memory integrity OK — 33 files, links + ✅ citations resolve." (matches the 33-file figure referenced in PR discussion)
- web `typecheck`/`lint`/`build` → **skipped, explicitly**. `growpod/web/node_modules` does not exist in this environment and a fresh `npm ci` was judged too slow to run under the time constraint; not attempted rather than risk a misleading partial result.

## Scope check
- In-scope diff (`git diff 3c6b7ee..b790d3c --stat`, 4 files): `docs/memory/BACKLOG.md` (+6), `docs/memory/MAP.md` (+1), `docs/memory/design/11-global-learning-memory.md` (new, 62 lines), `web/src/lib/chamber/chamberCore.ts` (+109/-35 lines, all renderer logic — hue/saturation tuning, pod count, pod width, bud-mass spline, skirt scaling).
- **Scope creep / out-of-scope changes:** **none.** Every changed file is plausibly part of "design/11 doc + Blue Dream round 3 renderer." No backend, economy, auth, or unrelated web files touched.

## Carried-risks ledger check
- Any OPEN RISK silently dropped from `docs/HANDOFF.md`? **No** — the ledger text is byte-identical since #106 (never rewritten by #107-#110), so nothing was dropped; it also was never actively re-examined.
- Any risk marked FIXED without a test backing it? **N/A** — no risk was marked FIXED in this range (the file wasn't edited at all).
- Cross-referenced each listed risk against `#107-#110`'s actual diffs (`git diff 6acd1e6..b790d3c --stat -- src/` → only `ai/anthropic_compat.py`, `ai/claude.py`, `ai/lecturer_claude.py` touched):
  - Rate limits / Redis (`RATELIMIT_ALLOW_MEMORY=true`) — **still open, unchanged.** `fly.toml:40` still sets `RATELIMIT_ALLOW_MEMORY = "true"`; `config.py:103` still defaults `RATELIMIT_STORAGE_URI` to `memory://`. Not touched by #107-#110.
  - Settlement deposit fail-closed / withdraw idempotency — **still open**, not touched; also still listed as a 🔴 open item in `BACKLOG.md`.
  - 5 no-op feature flags / web never reads `/flags` (BACKLOG REC-005) — **still open**, not touched.
  - No automated DB backups — **still open**, not touched.
  - Docs hygiene tail — **partially stale itself**: this very audit is evidence the docs-hygiene problem continues (HANDOFF not rewritten in 4 PRs).
  - **No risk was silently resolved by #107-#110** — the only functional backend change in that range (#107's adaptive-thinking fallback) is unrelated to any carried risk.

## Device-verifiable vs agent-verifiable
- Agent proved: design/11 doc content + MAP/BACKLOG registration; Blue Dream round-3 spline/skirt code changes; `make lint` and `make check-memory` green at claimed 33-file count; zero scope creep; HANDOFF.md untouched since #106 (definitive via `git diff`, not inference); live-incident evidence in INCIDENTS.md that the AI rollout NEXT ACTION predates #107.
- Owner must confirm by hand: visually compare a Blue Dream chamber render against the round-2/round-3 reference screenshots (renderer math was read, not rendered, in this audit); `make test` full backend suite result (not obtained this run — re-run `make test` and confirm pass count); web `npm run typecheck && npm run lint && npm run build` (not run — `node_modules` absent); confirm whether `/master-grower/ask` actually returns `provider: claude:...` in prod today (HANDOFF's NEXT ACTION treats this as still-pending, but evidence suggests it's already true).

## Verdict
**CONCERNS** — PR #110's own changes (design/11 doc + Blue Dream round 3 renderer) are clean, correctly scoped, and match their claims with file:line evidence; `make lint` and `make check-memory` are green. But the baton (`docs/HANDOFF.md`) is materially stale: it hasn't been rewritten across 4 merged PRs (#107-#110), its "What shipped" list omits all of them, and its single NEXT ACTION describes AI-stack rollout steps that live evidence (PR #107's commit + INCIDENTS.md) shows were already completed before #107 shipped. `make test` could not be confirmed in this run (backend) and web gates were not run at all (no `node_modules`) — both should be re-verified before treating this PASS as final.
