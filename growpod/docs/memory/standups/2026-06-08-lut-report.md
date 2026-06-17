# 🛰️ LUT Report — 2026-06-08, 08:00 Round Table

**Covers the day prior:** 2026-06-07 · **Repo:** KudbeeZero/GROWv2 · **Branch reviewed:**
`claude/lut-report-team-standup-zg3k5` (off `main` @ `991413b`)
**Health at a glance:** ✅ **139/139 tests green** (verified on branch) · ✅ CI green on `main` ·
✅ 0 open PRs · suite grew **79 → 139** in one day.

> Format: every specialty speaks in turn (what shipped / what I'm watching), then we triage what
> was **missed**, rank the work **immediate → medium → low**, agree **3 ways to make it better**,
> lay out the **game plan**, and note the **memory layers**.

---

## 0) One-paragraph summary for the person who skips standups
Yesterday was enormous: we went from a tested backend to a *playable, hardened, expanded* game in
a single day — production hardening (auth, errors, health, CI, Docker, OpenAPI), gameplay depth
(auctions, leaderboards, weather, automation, stabilization, contracts, ASA settlement), a full
Next.js web client, a security audit, and a major expansion (curing/terpenes, a research tree +
shop, and an AI "Master Grower" that can now *act* under a spend guard). Everything is green. The
debt we took on is **not in the code — it's in the docs and the dev setup**: the roadmap and a
handoff doc now describe a world that no longer exists, and a fresh `pip install` trips on system
PyYAML. None of that blocks players; all of it slows the next builder. This report fixes the
cheapest of those and queues the rest.

---

## 1) Round table — what each specialty shipped (2026-06-07)

**🧱 Backend / API** — Per-player API-key auth on all writes; uniform JSON error envelope + 1 MiB
body cap + global handlers; `/health` + `/readiness`; request-id access logs; `/openapi.json` +
Swagger UI at `/docs`; rate limiting on mutations. Two read-only list endpoints (`/players/<id>/pods`,
`/plants`). *Watching:* no idempotency keys on mutations yet.

**🌱 Simulation** — Engine stayed pure and compute-on-read. New `simulation/curing.py`: a
deterministic post-harvest quality model (diminishing returns toward an optimal window; over-drying
penalized). Weather events now feed the sim. *Watching:* read cost is O(elapsed hours) — fine today,
a cliff later.

**💰 Economy / Ledger** — ASA wallet settlement (withdraw/deposit mirrors ledger ↔ ASA); auction
system (bids, refunds, settlement); NPC contracts (GROW + XP); consumables shop as a GROW sink.
**Fixed a critical auction-bid exploit** (re-bidding the opening `min_bid` after the floor rose).
*Watching:* every new faucet needs a matching sink — keep the inflation guard honest.

**🧬 Genetics** — Quantitative terpene/cannabinoid traits (myrcene/limonene/caryophyllene/pinene)
now inherit through breeding and express on harvest, scaled by grow quality; dominant terpene earns
a sale premium. Strain stabilization (selfing/backcross) raises stability → unlocks NFT mint.

**⛓️ Chain / Algorand** — Provider abstraction solid; `TREASURY` sentinel named and resolved.
*Watching:* **still mock** — no funded TestNet, `ASA_ID` unset, metadata not on IPFS. The
abstraction is real; the live wiring is the gap.

**🤖 AI (Master Grower)** — New `ai/` package mirroring `chain/`: read-only `AdvisorProvider`
(mock + real Claude via official SDK, structured outputs) made the README's long-standing "advisor"
claim real, then made it **research-aware**. Then went **agentic**: `ai/autocare.py` can water/feed/
treat behind a **SpendGuard** (per-invocation GROW budget + action cap) so it *cannot* overspend —
every action posts through the normal ledger care path. CI uses the mock loop (no key needed).

**🖥️ Web / Frontend** — Next.js 15 (App Router + TS + Tailwind + React Query) client in `web/`:
onboarding + api-key capture, live grow dashboard polling `/state` with animated condition flags
(droop/bugs/mildew/sheen), care/environment/weather controls, strain lab, market (fixed + auctions),
contracts, leaderboards, account. *Watching:* web CI is lint/typecheck/build only — no e2e.

**🧪 QA / Testing** — Suite **79 → 139**, all green. Added property/invariant tests (ledger,
genetics, pricing monotonicity) and a regression for the auction exploit. Fixed a flaky pro-pod test
by disabling stochastic pests/disease in that case.

**⚙️ DevOps / CI** — GitHub Actions: lint + `alembic upgrade head` + seed + pytest on push/PR; a
path-filtered web CI; Dockerfile + compose (Postgres) + gunicorn; daily snapshot job. CI green
across the board.

**🛡️ Security** — Security audit (#4): anti-cheat, authz tightening, rate limiting, daily snapshot.
`SECURITY.md` + `SECURITY_AUDIT.md` in place. *Watching:* secrets/custodial key custody before any
real value moves.

**📚 Docs** — Space-themed manual suite under `docs/manual/` (game manual, getting-started,
glossary, lore, strain codex, strategy guide, tokenomics). *Watching:* `ROADMAP.md` and
`NEXT_SESSION_SPRINT3.md` now describe a stale world (see §2).

**🎯 Product / LiveOps** — Retention loop live (daily stipend + achievements, XP/leveling); seasonal
strain gating in place (default "all" until LiveOps rotates). Research tree (15 nodes / 5 branches)
gives long-term progression. Top-researchers leaderboard added.

---

## 2) ⚠️ What was missed — needs attention NOW
These don't break the game, but they actively mislead the next builder. Cheapest two are fixed in
this same change; the rest are queued in `BACKLOG.md`.

1. **The roadmap lies.** `docs/ROADMAP.md` still shows Sprints 1–3 as ⬜/🔨, but they shipped. Anyone
   planning from it re-does done work. → *reconciling now.*
2. **Stale handoff.** `docs/NEXT_SESSION_SPRINT3.md` describes work that's complete. → *retire it.*
3. **Build log header points at a dead branch** (`claude/cannabis-game-lut-economics-utfiK`). →
   *fixed now.*
4. **Fresh-machine install is broken.** `pip install -r requirements*.txt` fails on system PyYAML
   (`Cannot uninstall PyYAML 6.0.1, RECORD file not found`). A new contributor (or a web session)
   can't run tests without the `--ignore-installed PyYAML` workaround. → *needs a venv flow / pin fix
   + a SessionStart hook.*
5. **No project memory existed.** No `CLAUDE.md`, no durable context across sessions. → *fixed by this
   change (the memory layers).*

## 3) 📋 Triage — medium and low priority
**🟠 Medium (next 1–2 weeks):** CI coverage gate · Sprint 4 (real TestNet + IPFS + reconciliation) ·
sim-cost cap for dormant plants · idempotency keys on mutations · load/soak test `/state` · web e2e
smoke (Playwright).
**🟡 Low / later:** Sprint 5 multiplayer (trading, co-op, anti-cheat) · Sprint 6 LiveOps (events,
competitions, admin console, telemetry) · non-custodial Pera/WalletConnect · metrics/traces ·
secrets hardening · age-gating/compliance review.
*(Full, owned list in `docs/memory/BACKLOG.md`.)*

---

## 4) 🎯 3 ways to make everything better — toward "100% solid, manageable, buildable-on"
We're already green; "better" here means *durable*: hard to break, easy to extend, honest about its
own state. Three concrete, high-leverage moves (each gives ≥2 sub-actions):

### A. Make truth automatic, not manual ("the docs can never lie again")
- **Coverage gate in CI** with a floor (start at current, ratchet up) so the 139-test safety net
  can't silently erode.
- **A docs-drift check**: CI fails if `BUILDLOG.md`/`ROADMAP.md` reference a branch that no longer
  exists, or if a sprint marked ⬜ has a matching shipped feature. Plus the memory-layer rule
  (invariant changes must touch Layer 0/1 in the same PR).
- **One-command bootstrap** (`make setup` / SessionStart hook) that creates a venv and installs
  cleanly so "can you run the tests?" is always yes.

### B. Protect the core loop with contracts, not vigilance ("can't break it by accident")
- **Idempotency keys on every mutation** so retries/double-clicks can't double-spend the ledger.
- **Cap the sim's compute-on-read** (max catch-up window + background materialization for dormant
  plants) so a long-idle plant can't spike a request — turn the O(elapsed hours) risk into a bounded
  cost.
- **Promote the invariants in `ARCHITECTURE.md` into executable guards**: a startup assertion that
  the chain is non-authoritative, a property test that no money path bypasses the ledger.

### C. Prove the end-to-end story before players do ("confidence, not hope")
- **Web e2e smoke** (Playwright) walking the full loop grow→cure→sell→breed→stabilize→mint→trade,
  run in CI on the real mock backend.
- **Load/soak test** the `/state` catch-up path to find the cost knee, then set the cap in (B).
- **Finish the chain story on TestNet** (Sprint 4) so "on-chain" is demonstrably real, not mocked —
  with a DB↔chain reconciliation job that alarms on drift.

> Net effect: the codebase becomes *self-defending* — tests + gates catch regressions, contracts
> stop economy bugs, and the memory layers keep humans and agents aligned. That's what "as close to
> 100% sure we're done and it's manageable long-term" looks like in practice.

---

## 5) 🗺️ Game plan (laid out)

**This morning (≤1 hr, mostly done in this change):**
1. ✅ Stand up the memory layers (`CLAUDE.md` + `docs/memory/`).
2. ✅ Fix the build-log dead-branch reference.
3. 🔨 Reconcile `ROADMAP.md` (mark Sprints 1–3 shipped) + retire `NEXT_SESSION_SPRINT3.md`.
4. ⬜ File the env-install fix + SessionStart hook as the next task.

**This week (Sprint "Solidify"):** items in §4A + §4B — coverage gate, docs-drift check, one-command
setup, idempotency keys, sim-cost cap. Exit: a cold clone runs `make setup && pytest` green, CI
enforces coverage + doc-truth, and no mutation can double-post.

**Next 2 weeks (Sprint 4 — "Real chain"):** fund TestNet, wire `ASA_ID`, IPFS metadata,
reconciliation + `onchain_txid` audit, web e2e smoke. Exit: a real TestNet NFT minted end-to-end,
balances reconcile, full loop passes e2e.

**Then (Sprints 5–6):** multiplayer/social + LiveOps/tournaments, per the roadmap — built *on top*
of the solidified base without touching the invariants.

**Cadence:** one LUT report each working day in `docs/memory/standups/`; backlog is the single
source of priority; invariant changes update the memory layers in the same change.

---

## 6) 🧠 Memory layers (via MD) — now live
The "memory layers" idea is implemented as a Markdown system so every future session starts informed:

| Layer | File | Role |
|------|------|------|
| 0 | `CLAUDE.md` | Always-loaded identity + invariants + how to work |
| 1 | `docs/memory/ARCHITECTURE.md` | System map + the "don't break" list |
| 2 | `docs/memory/DECISIONS.md` | Append-only "why" log (ADRs) |
| 3 | `docs/memory/BACKLOG.md` | Prioritized work — now / medium / low |
| 4 | `docs/memory/standups/` | Dated LUT reports (this file) |

Maintenance rules and the read-top-down / write-bottom-up flow live in `docs/memory/README.md`.

---

*Prepared overnight; waiting for the 08:00 round table. — Standup compiled by Claude Code on
branch `claude/lut-report-team-standup-zg3k5`.*
