# 🛰️ SHIFT HANDOFF — GrowVerse / GrowPod Empire

> [!NOTE]
> **SUPERSEDED (2026-06-18).** This is an archived shift note from **2026-06-10 (PR #5 era)** and no
> longer reflects `main`. The **canonical baton is [`growpod/docs/HANDOFF.md`](docs/HANDOFF.md)** —
> read that for the current state, merged-PR ledger, carried risks, and the single NEXT ACTION.
> Kept below for history only.

**Outgoing shift:** local bring-up + strain-encyclopedia build.
**Date:** 2026-06-10 · **Branch:** `session/local-bringup` — **pushed**; **PR #5 open** → main.
**Owner decision:** HOLD for review/CI — do NOT merge/deploy yet.

---

## 1. What was done this session

### A. Local bring-up (verified working)
- App runs locally end-to-end. Backend (Flask) on `:10000`, web (Next 15) on `:3000`.
- Walked the core flow via API: create player (auth) → API-key write-auth (401/403) →
  create pod ("first room") → balance debited 500→400 GC (ledger sink works).
- Web `/onboarding` + `/dashboard` render; proxy + CORS both verified.
- **Fixes committed on this branch:**
  - `.gitignore`: now ignores `.env` / `.env.*` (was a secret-leak gap; `.env.example`
    documents real secrets like `ANTHROPIC_API_KEY`, `ALGO_TREASURY_MNEMONIC`).
  - `web/.env.local` (gitignored): makes a bare `npm run dev` reach the backend
    (the rewrite default was `:8000`, backend serves `:10000`).
  - Pre-existing uncommitted `web/next.config.mjs` (dev-only CSP `unsafe-eval` for HMR)
    and `web/package-lock.json` were present on arrival; left intact.
- Full detail: `CLAUDE_SESSION_NOTES.md`.

### B. Strain Encyclopedia (new, additive — touches NO game code)
- New `docs/encyclopedia/` research database. **12 strains** complete & validated
  (Gelato, Wedding Cake, Runtz, Zkittlez, Gushers, Sunset Sherbet, Do-Si-Dos, Biscotti,
  MAC, Cereal Milk, Ice Cream Cake, Apple Fritter).
- Each entry = full real-world profile + a paste-ready `game_mapping` block conforming
  to the game's exact schema (4 terpene genes; rarity/lineage enums; trait bounds).
- Built by a 12-agent research workflow → schema-validated → rendered. 12/12 pass
  `yaml.safe_load` + game-bounds + lineage ∈ {landrace, hybrid}.

---

## 2. Current state
- **Servers:** backend pid + web pid were running locally this session (foreground
  background jobs — they stop when the session shell exits). Re-launch:
  `PYTHONPATH=src .venv/bin/python server.py` and `cd web && npm run dev`.
- **Tests:** 182 passed earlier; re-run for audit (`make test`).
- **Research loop:** **STOPPED/finalized** for handoff (`_ledger.json` →
  `loop.status = finalized-for-handoff`). No wakeups will continue it.
- **Git:** all work sits on `session/local-bringup`. `main` is unchanged. Nothing pushed.

---

## 3. ⚠️ Merge/deploy status — HOLD (owner decision 2026-06-10)
Owner chose **Hold for review/CI**. Branch is pushed; **PR #5** is open. **Do NOT merge to main** until reviewed — merging auto-deploys to prod. Context:
1. **Pushing `main` auto-deploys to PRODUCTION.** `render.yaml` has
   `autoDeploy: true`, `branch: main`, and a `preDeployCommand` that runs
   `alembic upgrade head && db.seed` against the **prod Postgres**. A push to
   `origin/main` = a live deploy. The original shift's hard rule was "do NOT deploy."
   → Confirm this is intended before any push to main.
2. **Active plant work exists on other remote branches**
   (`origin/claude/grow-chamber-plants-*`, `origin/claude/plant-stage-timeline`).
   The owner earlier said "don't change code, there's stuff going on with the plants."
   → Merging this branch to main may need coordination with that work / CI.
3. Recommended safe path: open a **PR** from `session/local-bringup` → review/CI →
   merge (which then deploys). Avoids a direct unreviewed push to a prod-deploying branch.

---

## 4. For the NEXT SHIFT — resume the encyclopedia loop
- **81 strains remain queued** in `docs/encyclopedia/_ledger.json` (`queue`).
- To run another batch, follow `docs/encyclopedia/RUNBOOK.md`:
  1. Take next 12 from `queue`.
  2. `Workflow({scriptPath: "<saved strain-research-batch script>", args: <12 names>})`
  3. `.venv/bin/python docs/encyclopedia/_render.py docs/encyclopedia/_batch_NN.json "Batch NN"`
  4. Validate; optionally re-enable the loop by raising `loop.iterations_planned`.
- **Lessons baked into RUNBOOK** (don't relearn): write files with Python not the Write
  tool (it appends `</content>`); workflow `args` arrive as a string; YAML `#` breaks
  flow lists (renderer uses `yaml.safe_dump`); never emit `lineage_type: bred`.

## 5. Archive readiness
- **Archivable now.** Work is durable on `origin/session/local-bringup` + PR #5.
  Final step (merge → prod deploy) is intentionally deferred to review/CI per owner.
- Auditor review: advisor consulted; finalize approach approved (decompose push/PR/merge).
- Evidence: `make test` → 182 passed; encyclopedia 12/12 validated.
