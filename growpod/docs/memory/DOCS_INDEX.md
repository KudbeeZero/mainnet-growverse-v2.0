# Docs index — every Markdown file, tracked (2026-07-02 sweep)

> The repo carries ~160 .md files; until now only `docs/memory/` was tracked and the rest rotted
> silently (the deploy runbook said "nothing is deployed" while prod was live). This index is the
> tracking layer: every doc has a ROLE and STATUS. **Rule:** touch a system → check its docs row
> here; a session that makes a LIVING doc wrong fixes the doc in the same PR. Historical docs are
> frozen — never "corrected", only bannered.

Roles: **living** (must stay true) · **historical** (frozen record) · **spec** (plan/design) ·
**scaffolding**. Status: ✅ current · ⚠️ stale (see fix list) · 🧊 frozen-OK · 🗑 retire.

## Living docs (the ones that can lie — keep these true)

| Doc | Note |
|---|---|
| `CLAUDE.md` + `docs/memory/*` (MAP, ARCHITECTURE, DECISIONS, BACKLOG, INCIDENTS, this file) | ✅ the enforced memory core (`make check-memory`) |
| `docs/HANDOFF.md` (the baton) | ✅ rewritten 2026-07-02 — was ~80 PRs stale; candidate for a check-memory staleness rule like BACKLOG's |
| Runbooks: `LOCAL_SETUP.md`, `TESTENV.md`, `docs/TESTER_RUNBOOK.md`, `docs/DEPLOY_FLY.md`, `docs/ALGORAND_DEV.md`, repo-root CONTRIBUTING.md and docs/ops/MERGE_GATING_SETUP.md (one level above growpod/) | ✅ (DEPLOY_FLY corrected 2026-07-02: the API IS deployed + auto-deploys) |
| Charters: `docs/BUILD_RULES.md`, `docs/GLOBAL_EVIDENCE_MEMORY_LAYER.md`, `docs/SESSION_PROTOCOL.md`, `docs/OMNI_CHARTER.md` | ✅ governance stack |
| `SECURITY.md` (+ `docs/licenses/README.md` rights record) | ✅ corrected 2026-07-02 (snapshot claim, pod-stills note) |
| `docs/manual/` (player manual, 8 files) · `web/README.md` | ✅ |
| `.claude/skills/closeout/SKILL.md` + `.claude/skills/handoff-audit/SKILL.md` | ✅ process skills |
| `knowledge/` (10 canonical morphology/botany specs) + `docs/BUD_ARCHITECTURE_BLUEPRINT.md` | ✅ cited by the Design Codex |

## Spec / planning docs

| Doc | Note |
|---|---|
| `docs/memory/design/00–10` (Design Codex, 12 files) | ✅ MAP-enforced |
| `docs/product/` (6 GROWVERSE_* packages) | ✅ status-labeled, MAP-indexed |
| `docs/research/` (12 dated docs) + `docs/research/university/` (8) | 🧊 inputs to the codex; MASTER_BIBLE freeze banner superseded 2026-07-02 (University shipped) |
| `docs/encyclopedia/` (17 strain-science files) | ✅ additive research DB |
| `docs/ROADMAP.md`, PHASE1/2/3 docs, `docs/SIMULATION_TEST_CLOCK.md` | ✅/aging — dated baselines, not wrong |
| `docs/00–09` numbered status snapshots (2026-06-19 baseline) | ⚠️ snapshot-dated; 01/04/05 claim the backend is "future" — it's deployed. Treat as history unless refreshed |

## Historical (frozen — do not edit, banner if misleading)

`CLAUDE_SESSION_NOTES.md` · `SESSION-LOG.md` · `growpod/HANDOFF.md` (superseded banner) ·
`night-reports/` (3) · `docs/QA_AUDIT.md` · `docs/STEP4_E2E_GROW_LOOP_VALIDATION.md` ·
`docs/audits/` (4 PR audits) · `docs/memory/standups/` (11) · `SECURITY_AUDIT.md` (2026-06-07
audit; snapshot-workflow claim corrected in SECURITY.md) · root `CLONE_ROOM_QA_REPORT.md`
(legacy root Node service) · `docs/DATABASE_SYSTEMS_AUDIT.md` + root `docs/` twin (its #1
"CI never runs" finding is fixed/false today) · `docs/NEXT_SESSION_SPRINT3.md` (self-tombstoned)

## ⚠️ Stale ledger (found 2026-07-02; fix-in-same-PR rule applies from now on)

| Doc | Wrong claim | State |
|---|---|---|
| `docs/DEPLOY_FLY.md` | "Nothing is deployed" | ✅ FIXED 2026-07-02 |
| `SECURITY.md` | daily snapshots "scheduled via snapshot.yml" (doesn't exist) | ✅ FIXED 2026-07-02 (marked not-yet-automated; BACKLOG tracks the workflow) |
| `docs/HANDOFF.md` | main at PR #22 | ✅ REWRITTEN 2026-07-02 |
| `docs/licenses/README.md`, `web/public/buds/README.md` | reference deleted `web/public/pod/*` stills | ✅ NOTED 2026-07-02 (revert recorded) |
| `docs/research/university/GROWPOD_UNIVERSITY_MASTER_BIBLE.md` | "University PARKED until after MVP" | ✅ BANNERED 2026-07-02 (shipped as HERMES) |
| `BUILDLOG.md` | "record of what shipped" but ends ~PR #50 | ⚠️ open — resume or tombstone (BACKLOG) |
| `docs/memory/CANONICAL_STATE.md`, `docs/STUDIO_AGENT_REGISTRY.md`, `docs/AGENT_ORCHESTRATION_LEDGER.md` | "Live" ledgers frozen at 2026-06-14 | ⚠️ open — refresh or restamp as snapshots (BACKLOG) |
| `docs/DEV_BUILD_LOG.md` | Replit-era workflow | ⚠️ open — retire (BACKLOG) |
| `growpod/docs/01_GROWVERSE_CURRENT_STATUS 2.md` | byte-identical duplicate | ✅ DELETED 2026-07-02 |
| growpod/.pytest_cache/README.md (removed) | committed cache artifact that said "do not commit" | ✅ DELETED 2026-07-02 (+ gitignored) |
