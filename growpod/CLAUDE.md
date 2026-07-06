# CLAUDE.md — GROWv2 agent memory (Layer 0)

> This is the **always-loaded** top layer of the project's memory system. Keep it short,
> stable, and true. Deeper, more volatile detail lives in `docs/memory/` (see the layer map
> below). If something here is wrong, fix it here first — every session reads this file.

## What this is
**GROWv2** (package `growpodempire`) is a cannabis-growing game with a persistent economy,
real strain genetics/crossbreeding, a real-time grow simulation, an Algorand on-chain asset
layer, and an AI "Master Grower" advisor. Backend is Python/Flask; the web client is Next.js 15
in `web/`. The database is SQLAlchemy + Alembic (SQLite in dev, Postgres in prod).

## North star
Take a working, tested backend → a launchable, long-lived live game, **without breaking the
core loop**: grow → care → harvest → cure → sell/breed/stabilize → mint → trade.

**GrowVerse direction (adopted 2026-07-06).** The path from here to a shipped beta is the 22-phase
roadmap in `docs/memory/GROWVERSE_ROADMAP.md`, built one branch at a time via
`docs/memory/EXECUTION_MACHINE.md` — start there. Same invariants as below; nothing new.

## How to work here (conventions that must not drift)
- **DB is authoritative; the chain is a mirror/settlement layer.** Never let on-chain state
  drive gameplay truth.
- **The simulation engine is pure and server-authoritative.** `simulation/` computes plant state
  on read (compute-on-read, lazy catch-up). Do **not** put player-scoped economy/research logic
  inside the pure engine — layer it in `services/`.
- **Money is `Decimal`, ledger-based, double-entry-ish, auditable.** Every spend/earn posts to the
  ledger. No floats for money. Faucets must have matching sinks (watch inflation).
- **Writes require API-key auth; reads are public.** Mutations are rate-limited.
- **Providers are swappable behind ABCs** (`chain/`, `ai/`): a deterministic Mock for tests/CI and
  a real provider for prod, chosen by config. CI runs with mocks — **never require a live key in CI.**
- **`balance.yaml` is the tuning surface.** Prefer data-driven balance changes over code changes.
- Keep the test suite green and add a test with every feature. Property/invariant tests guard the
  ledger and genetics.
- **The backlog is part of the workflow.** Every session that ships work reconciles
  `docs/memory/BACKLOG.md` (tick done/doing, add new work, bump `Last reconciled`) before
  closing. Enforced: `make check-memory` fails when the backlog is >14 days behind HEAD.
- **The twice rule.** Before debugging any operational problem, check
  `docs/memory/INCIDENTS.md`; apply recorded fixes instead of re-deriving them. Any problem
  hit a second time gets a root-cause fix recorded there — never a second workaround.

## Run it
```bash
make setup                   # one-time: venv + deps + editable install
make test                    # full suite + coverage gate (ratchet floor in pyproject.toml)
make lint                    # the lint gate CI uses
make serve                   # local API   (web: cd web && npm i && npm run dev)
```
Claude Code on the web installs deps automatically via `.claude/hooks/session-start.sh`
(it sets `PYTHONPATH=src`, mirroring CI). The bare `pip install` path collides with a
distro-managed PyYAML on some boxes — use `make setup` (a venv) locally to avoid it.

## Owner delegation charter (how much permission you have)
The owner pre-approves project-scoped autonomy. When asked to do something, do it **beginning
to end** — build, verify, commit, push — without asking permission mid-task. We can always
revert; that's what review and git are for.
- **Decide small tradeoffs yourself** (e.g., a cosmetic nicety vs. an 800 ms win → take the win)
  and note the call in one line. Don't present option menus for things under ~an hour of rework.
- **Stop and ask ONLY for:** real money / chain settlement / treasury actions; deleting data or
  rewriting git history; player-facing economy changes (faucets/sinks/prices); anything that
  contradicts an invariant above; or a genuine fork where rework would be large and the owner's
  taste decides (visual identity, scope cuts).
- Scope is **this project only** — never the wider machine. The allowlist in
  `.claude/settings.json` reflects this: exact project gates (no `make *`/`npm run *`/`node *`
  wildcards — those are arbitrary-exec hatches), pushes only to `claude/*` branches, and
  destructive git denied (force/refspec-force/branch-delete/amend/reset-hard/clean/checkout-discard).

## End-of-chat report (every chat, no exceptions)
End **every** status update, handoff, PR report, audit result, or stopping-point message with
this **exact** closeout format, and keep it SHORT:

> **Asked:**
> * Briefly state what the assignment/request was.
>
> **Done:**
> * Briefly state what was completed, verified, opened, merged, frozen, or checked.
>
> **Needs you:**
> * State the next human decision/action needed.
> * If no action is needed, say: "Nothing right now — holding/subscribed/standing by."

Keep it short and concrete. Do **not** mix future work into "Done." Do **not** hide required
decisions inside paragraphs. If a detail doesn't change what the owner does next, it belongs in
the PR body or the baton, not the report. This is the chat-facing summary; the repo-facing
closeout (baton rewrite, audit receipt, Summary→Next) is defined in `docs/SESSION_PROTOCOL.md`.

## Build safely (the safety charter)
Before writing code, **audit**; before expanding scope, **ask**; before merging, **prove**;
before new features, **protect the foundation**. One PR = one purpose. Migrations, economy
(`src/growpodempire/data/balance.yaml`), feature flags, wallet/auth and lockfiles are protected
surfaces — touch them only with the checks and stop-conditions spelled out in the
[Global Build Rules — Safety Charter](docs/BUILD_RULES.md). When in doubt, stop and ask.

**Reason before you recommend.** Above the safety charter sits the
[Global Evidence + Memory Layer](docs/GLOBAL_EVIDENCE_MEMORY_LAYER.md) — the decision loop
every run follows *before* recommending: reconcile project memory ↔ current repo evidence ↔
decision confidence, label each finding (Verified / Memory conflict / Needs owner decision /
Unsafe to proceed, …), and gate on the owner where required. BUILD_RULES is *what is safe to
change*; this is *how to decide what's true and what to do next*.

## Memory layer map (read deeper as needed)
| Layer | File | Purpose | Volatility |
|------|------|---------|-----------|
| 0 | `CLAUDE.md` (this file) | Identity, invariants, how to work | Low |
| 1 | `docs/memory/ARCHITECTURE.md` | System map + load-bearing invariants ("don't break") | Low |
| 1 | `docs/memory/ARCHITECTURE_TRUTH.md` | GrowVerse verified current-state baseline (3-audit inventory) | Refreshed per phase |
| 1+ | `docs/memory/design/` | **Design Codex** — deep vision/intent: the moat, the scientist-grade sim & generative-genetics targets ("where we're going") | Low |
| 1+ | `docs/memory/GROWVERSE_ROADMAP.md` | GrowVerse Master Roadmap — the 22-phase upgrade path + First 10 PRs + 30/60/90 | Low |
| — | `docs/memory/EXECUTION_MACHINE.md` | Dynamic build loop + live next-branch pointer — **start here to build** | Live |
| 2 | `docs/memory/DECISIONS.md` | Why things are the way they are (ADR log) | Append-only |
| 3 | `docs/memory/BACKLOG.md` | Prioritized work: now / medium / low | High |
| 3 | `docs/memory/VERIFIED_RENDERS.md` | Screenshot archive ("chapter list"): golden renders + regen recipes — check it BEFORE building any screenshot rig; capture via the `capture-shots` skill | Append-mostly |
| 4 | `docs/memory/standups/` | Dated LUT round-table reports | Daily |

See `docs/memory/MAP.md` for the master map (layer index + code↔doc index + moat build-state
dashboard) and `docs/memory/README.md` for how the layers fit together and how to maintain them.
Memory integrity is enforced: `make check-memory` (and CI) fails on broken links, ✅ claims that
cite missing paths, or a codex that drifts out of the layer map.
