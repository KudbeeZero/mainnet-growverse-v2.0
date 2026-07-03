<!-- ╔═══════════════════════════════════════════════════════════════════════╗ -->
<!-- ║   GROWPOD EMPIRE · MISSION CONTROL · README HUB                        ║ -->
<!-- ╚═══════════════════════════════════════════════════════════════════════╝ -->

<div align="center">

```
  .      *       .          .        *           .         *      .        .
     .       ____                 ____           _   _____                  *
   *        / ___|_ __ _____  __ |  _ \ ___   __| | | ____|_ __ ___  _ __    .
      .    | |  _| '__/ _ \ \/ / | |_) / _ \ / _` | |  _| | '_ ` _ \| '_ \    .
   *       | |_| | | | (_) >  <  |  __/ (_) | (_| | | |___| | | | | | |_) |  *
     .      \____|_|  \___/_/\_\ |_|   \___/ \__,_| |_____|_| |_| |_| .__/ .
        .        ·  a persistent cannabis-grow empire in orbit  ·    |_|
  *        .          *        .          .       *        .        .     *
```

# 🛰️  GrowPod Empire — Mission Control

### *Grow. Breed. Trade. Stabilize. Mint. Conquer the orbital greenhouse.*

A persistent-economy cultivation **game**: real genetics & crossbreeding, a
deterministic real-time grow simulation, an auditable `GROW` ledger economy,
a procedurally rendered grow chamber, and an Algorand on-chain asset layer
where your rarest strains become NFTs.

<br/>

![Status](https://img.shields.io/badge/STATUS-IN__ORBIT-22C55E?style=for-the-badge&labelColor=0B0E2C)
![Phase](https://img.shields.io/badge/BUILD-Core__Loop__Launch__Track-7C3AED?style=for-the-badge&labelColor=0B0E2C)
![Backend](https://img.shields.io/badge/BACKEND-108_test_files_·_cov_gate_79%25-22C55E?style=for-the-badge&labelColor=0B0E2C)
![Web](https://img.shields.io/badge/WEB_TESTS-478_passing-22C55E?style=for-the-badge&labelColor=0B0E2C)
![Chain](https://img.shields.io/badge/ALGORAND-TestNet-000000?style=for-the-badge&labelColor=0B0E2C)
![License](https://img.shields.io/badge/LICENSE-MIT-FACC15?style=for-the-badge&labelColor=0B0E2C)

</div>

---

<div align="center">

### 📡  CHOOSE YOUR FLIGHT PLAN

*Everything you need to play, master, and understand the Empire.*

</div>

<table>
<tr>
<td width="33%" valign="top">

### 🚀 [Getting Started](docs/manual/getting-started.md)
**New pilot? Start here.**
Your first hour: claim your grant, buy a seed, raise a plant from sprout to
harvest, and make your first sale — step by step.

</td>
<td width="33%" valign="top">

### 📖 [Game Manual](docs/manual/game-manual.md)
**The complete reference.**
Every system, every stat, every threshold, every API endpoint. The encyclopedia
of how the Empire actually works under the hood.

</td>
<td width="33%" valign="top">

### 🧠 [Strategy Guide](docs/manual/strategy-guide.md)
**Master-class min-maxing.**
The exact formulas, optimal build orders, breeding meta, economy math, and the
fastest routes to a stabilized, mintable, money-printing line.

</td>
</tr>
<tr>
<td width="33%" valign="top">

### 🧬 [Strain Codex](docs/manual/strain-codex.md)
**The orbital seed vault.**
A Pokédex-style catalog of all 16 founding strains — full genome stats,
terpene profiles, difficulty, and a breeding tier list.

</td>
<td width="33%" valign="top">

### 🪙 [Tokenomics](docs/manual/tokenomics.md)
**The GROW economy & token.**
Faucets, sinks, the burn, the Algorand ASA, supply schedule, and the live
**Token Observatory** price ticker.

</td>
<td width="33%" valign="top">

### 🛸 [Lore](docs/manual/lore.md)
**What makes us different.**
The story of the orbital greenhouse, the Empire's mission, and the philosophy
behind a grow-game you can actually *own*.

</td>
</tr>
<tr>
<td width="33%" valign="top">

### 📡 [Glossary](docs/manual/glossary.md)
**Speak the language.**
Every term, acronym, and stat defined in one quick-scan reference.

</td>
<td width="33%" valign="top">

### 🗺️ [Roadmap](docs/ROADMAP.md)
**Where the Empire is heading.**
The flight plan: sprints, exit criteria, and what ships next.

</td>
<td width="33%" valign="top">

### 🛠️ [API Reference](docs/manual/game-manual.md)
**For builders & bots.**
The REST surface — pair the manual's API chapter with the live, generated
`GET /openapi.json` + Swagger UI at `/docs` to automate your whole operation.

</td>
</tr>
</table>

---

## ⭐ What is GrowPod Empire?

You command a pod — a sealed growing chamber in an orbital greenhouse. Inside it,
plants are **simulated in real time**: they drink, feed, droop, attract pests,
catch mildew, recover, and flower on their own genetic clock. Neglect a plant and
it withers; tend it well and it rewards you at harvest.

But cultivation is only the engine. The **game** is the loop around it:

```
        ┌─────────────────────────────────────────────────────────────┐
        │                                                               │
   ╭────▼────╮   ╭─────────╮   ╭─────────╮   ╭──────────╮   ╭────────╮  │
   │  GROW   │──▶│  CARE    │──▶│ HARVEST │──▶│ SELL or  │──▶│ BREED  │──┘
   │ a seed  │   │ the sim  │   │ by health│   │  TRADE   │   │ a line │
   ╰─────────╯   ╰─────────╯   ╰─────────╯   ╰──────────╯   ╰───┬────╯
                                                                 │
                            ╭───────────╮   ╭──────────────╮     │
                            │   MINT    │◀──│  STABILIZE    │◀────╯
                            │  an NFT   │   │ the new strain│
                            ╰───────────╯   ╰──────────────╯
```

## 🕹️ What's playable today

- 🎮 **The care loop, on one panel** — the Grow Chamber is the game hub: six
  embedded action tiles (Water / Feed / Prune / Train / Inspect / Boost) that
  glow when available and explain themselves when not, a ranked **Today's Plan**,
  **Plant Insights**, per-action visual plant reactions, and post-harvest
  next-actions. Verified end-to-end by the `care-loop` Playwright spec.
- 🌿 **A procedural 2D plant renderer** — every plant is drawn live on canvas
  from its strain genetics (`web/src/lib/chamber/`): candelabra branch
  architecture, textured leaflets and calyx bracts, pistils, trichome frost,
  purple-dominant colas. Refined across owner-reviewed render rounds (latest:
  round 8c texture layering); golden renders are archived in
  [`docs/memory/VERIFIED_RENDERS.md`](docs/memory/VERIFIED_RENDERS.md).
- 🕹️ **A chamber arcade layer** — grow-speed boosts with live multiplier and
  cooldowns (shared zustand `boostEngine` store), a ⏪ REWIND snapshot scrubber,
  and ambient chamber glow.
- 🔬 **The Lab** — a trichome **microscope** with a live-plant deep-link
  (`?plantId=` seeded from server telemetry), the **breeding** bench
  (deterministic 9-trait crossbreeding), the **GenBank**, and the strain library.
- 🏛️ **University** — catalog, courses, coach, learner model, and transcript
  (the HERMES track: an online school for cannabis, produced-once lessons).
- 🏪 **Economy surfaces** — Market (fixed listings + auctions), the seasonal
  **Cannabis Cup** + Hall of Fame, **Factions**, Leaderboards, grow Contracts,
  and the Store.
- ⛓️ **The Algorand layer** — in the web client: wallet connect (Pera / Defly /
  WalletConnect via `@txnlab/use-wallet`) and NFT minting, entirely behind the
  `NEXT_PUBLIC_ALGO_ENABLE` build flag (off ⇒ the chain layer is a no-op;
  `NEXT_PUBLIC_ALGO_SIMULATE` defaults to true ⇒ log, never send). On the
  backend: a swappable chain-provider ABC (`chain/`) — deterministic mock for
  tests/CI, real Algorand TestNet for prod — with ARC-3 NFT metadata built from
  **server truth**, never the client's cosmetic view.
- 🤖 **AI Master Grower** — an advisor reads a plant's live state and recommends
  care (and can run **agentic auto-care** within a spend cap). Powered by Claude
  when a key is set, with an offline deterministic fallback (`ai/` provider ABC).
- 🌱 **Depth systems** — real genetics with dominance & segregation variance,
  compute-on-read real-time simulation (fixed 1-hour steps; the world grows while
  you're away), an auditable append-only `Decimal` ledger, post-harvest
  **curing**, **terpene** genetics, a **research tree**, consumables, seasonal
  strains, badges, and weather.

### 🔨 In progress / parked (honestly labeled)

- **Store restructure** — the Store sells consumables, but the "use item" flow
  (`POST …/plants/<id>/apply`) isn't wired into the UI yet.
- **Algorand real-value settlement** — minting runs in **simulate mode** by
  default; production token flows and the non-custodial wallet path are on the
  backlog. The fiat payment rail is parked by owner decision (launch liquidity
  is bring-your-own ALGO).
- **Smart contracts** — none yet: today's chain layer is ASA + ARC-3 assets via
  the provider ABC. On-chain contracts are a future phase.
- **3D bud/model work** — frozen by owner directive (2026-07-02) in favor of the
  2D core loop; the Bud Viewer route is parked behind a "Coming soon" chip.

---

## 🗺️ The directory — where everything lives

The repo root is `growpod/`. Top two levels, one line each:

| Path | What it is |
|---|---|
| **`src/growpodempire/`** | **The Flask backend package** (Python, SQLAlchemy + Alembic; SQLite dev / Postgres prod) |
| &nbsp;&nbsp;├ `api/` | Flask routes + auth (API-key writes), rate limiting, validation, errors, observability, generated OpenAPI |
| &nbsp;&nbsp;├ `services/` | The orchestration layer — **all** player-scoped logic (~30 services: game, economy, minting, cup, university, autocare, …) |
| &nbsp;&nbsp;├ `simulation/` | The **pure, deterministic** grow engine — compute-on-read lazy catch-up (clock, horticulture, reactions, conditions, curing) |
| &nbsp;&nbsp;├ `genetics/` | Traits + deterministic, replayable crossbreeding |
| &nbsp;&nbsp;├ `economy/` | The `Decimal`-only, append-only ledger + pricing |
| &nbsp;&nbsp;├ `chain/` | Chain-provider ABC: deterministic mock + real Algorand, ARC-3 metadata, the `GROW` ASA, `TREASURY` sentinel |
| &nbsp;&nbsp;├ `ai/` | AI-provider ABC: mock + Claude (Master Grower, autocare, lecturers, narrator) |
| &nbsp;&nbsp;├ `db/` | SQLAlchemy models, session, seed (16 founding strains) |
| &nbsp;&nbsp;└ `data/` | **`balance.yaml`** — the tuning surface — plus strains / curriculum / factions / terpene YAML |
| **`web/`** | **The Next.js 15 client** (App Router, TypeScript, Tailwind, React Query, zustand) |
| &nbsp;&nbsp;├ `src/app/` | Routes: `dashboard` (+ per-plant **chamber** / command / bud), `lab` (microscope · breed · genbank · strains), `university`, `market`, `cup`, `factions`, `store`, `leaderboards`, `onboarding`/`ftue`, `mission`, `guide`, `profile`, `admin/economy`, `dev` |
| &nbsp;&nbsp;├ `src/components/` | UI by area: `plant/` (ChamberDock, care tiles, reactions), `arcade/`, `market/`, `university/`, `wallet/`, `harvest/`, `onboarding/`, `layout/`, `ui/`, … |
| &nbsp;&nbsp;├ `src/lib/` | Client logic: `chamber/` (the procedural plant renderer), `chain/algorand/` (wallet + mint), `api/`, `arcade/`, pure helpers with unit tests |
| &nbsp;&nbsp;├ `e2e/` | Playwright specs + shared mock-API fixtures (`fixtures/mockGame.ts`) + the parameterized screenshot `capture.spec.ts` |
| &nbsp;&nbsp;└ `scripts/` | `gen-stage-pngs.ts` (stage sprite generation) |
| **`tests/`** | Backend pytest suite — 108 test files, property/invariant tests guarding the ledger & genetics, coverage gate in `pyproject.toml` |
| **`docs/`** | All documentation |
| &nbsp;&nbsp;├ `memory/` | **The agent brain** (layered memory): `ARCHITECTURE` · `DECISIONS` · `BACKLOG` · `MAP` · `CANONICAL_STATE` · `INCIDENTS` · `VERIFIED_RENDERS` · `design/` codex · `standups/` · `verification/golden/` |
| &nbsp;&nbsp;├ `manual/` | The player-facing docs this README links to (manual, codex, tokenomics, lore, …) |
| &nbsp;&nbsp;└ *(root)* | Roadmap, phase specs, `BUILD_RULES.md` safety charter, `SESSION_PROTOCOL.md`, deploy/ops runbooks, audits, research |
| **`knowledge/`** | Horticulture & genetics source-of-truth notes (botanical bible, plant anatomy, procedural-generation rules) feeding the sim + renderer |
| **`scripts/`** | Dev/CI helpers: `check_memory.py` (memory gate), `check_single_head.py` (migration gate), `testenv-up.sh`, `algo_devwallet.py` |
| **`alembic/`** | Database migrations (single-head graph, enforced by `make check-migrations`) |
| **`lib/`** | Generated API artifacts: `api-spec`, `api-zod`, `api-client-react`, `db` |
| **`.claude/`** | Agent config: session-start hook, settings allowlist, and `skills/` (`capture-shots` · `handoff-audit` · `closeout`) |
| **`artifacts/` · `night-reports/`** | Build sandboxes and dated overnight sweep reports |
| `Makefile` · `server.py` · `pyproject.toml` | The gates (`make test/lint/check-memory`), the API entry point, and the coverage ratchet |

---

## 🚀 Quick Launch (run it yourself)

```bash
# 1. One-time setup: venv + deps + editable install
make setup

# 2. Seed the 16 founding strains + store data (idempotent; schema auto-creates on boot)
.venv/bin/python -m growpodempire.db.seed

# 3. Serve the API  →  http://localhost:10000
make serve

# 4. Launch the web client  →  http://localhost:3000
cd web && npm install && npm run dev
```

Runs against the **mock chain and mock AI** out of the box — no secrets, no
funds, no external services. To mint for real on Algorand TestNet, see
**[Tokenomics](docs/manual/tokenomics.md)** and `docs/ALGORAND_DEV.md`.
An alternative gunicorn + Next-proxy setup (backend on `:8000`, zero env files)
is documented in **[LOCAL_SETUP.md](LOCAL_SETUP.md)**.

**Test & quality gates** (the same ones CI runs):

```bash
make test              # backend: pytest + coverage gate (floor in pyproject.toml)
make lint              # the ruff gate CI uses
make check-memory      # memory-layer integrity (links, ✅ citations, structure)
make check-migrations  # Alembic graph must have exactly one head

cd web
npx vitest run         # 478 unit tests across 54 files
npx playwright test    # e2e + the screenshot capture harness
```

---

## 🧠 Memory & agent workflow

This repo is built session-by-session by AI agents under an owner charter, and
it carries its own **layered memory** so no session starts cold:

- **[`CLAUDE.md`](CLAUDE.md)** — Layer 0, always loaded: identity, the
  invariants that must not drift (DB authoritative / pure simulation /
  `Decimal` ledger / swappable providers / `balance.yaml` tuning), the
  delegation charter, and the layer map.
- **[`docs/memory/`](docs/memory/MAP.md)** — the brain:
  [`ARCHITECTURE.md`](docs/memory/ARCHITECTURE.md) (the "don't break" list),
  [`DECISIONS.md`](docs/memory/DECISIONS.md) (append-only ADRs),
  [`BACKLOG.md`](docs/memory/BACKLOG.md) (the single source of priority),
  [`VERIFIED_RENDERS.md`](docs/memory/VERIFIED_RENDERS.md) (the golden-render
  chapter list), the `design/` codex (where we're going), and dated
  `standups/`. Integrity is CI-enforced via `make check-memory`.
- **[`.claude/skills/`](.claude/skills)** — project skills:
  `handoff-audit` (session start: audit the previous PR against its claims),
  `closeout` (session end: gates, baton, one PR), and `capture-shots`
  (the shared visual-verification harness).

---

## 🧭 Find your way around

| If you want to… | Go to |
|---|---|
| Play for the first time | 🚀 [Getting Started](docs/manual/getting-started.md) |
| Look up exactly how a mechanic works | 📖 [Game Manual](docs/manual/game-manual.md) |
| Win — fast, optimally | 🧠 [Strategy Guide](docs/manual/strategy-guide.md) |
| Pick the best strain to grow or breed | 🧬 [Strain Codex](docs/manual/strain-codex.md) |
| Understand the money & the token | 🪙 [Tokenomics](docs/manual/tokenomics.md) |
| Know what a word means | 📡 [Glossary](docs/manual/glossary.md) |
| Automate with the API | 🛠️ [Game Manual · API](docs/manual/game-manual.md) + `GET /openapi.json` |
| Understand the architecture | 🏗️ [ARCHITECTURE.md](docs/memory/ARCHITECTURE.md) + [MAP.md](docs/memory/MAP.md) |
| See what's shipping now | 📋 [BACKLOG.md](docs/memory/BACKLOG.md) |
| See what's coming | 🗺️ [Roadmap](docs/ROADMAP.md) |

---

<div align="center">

### 🛰️ Built for the long haul

`Phase 1` Persistent DB + ledger economy + genetics  ·  `Phase 2` Real-time grow
sim  ·  `Phase 3` Algorand ASA + ARC-3 NFTs  ·  `Now` the playable core loop on
the stylized 2D chamber — launch-readiness track

Simulation & entertainment only. No real cannabis is grown, sold, or shipped.
Age-gating and compliance framing apply — see the [Roadmap](docs/ROADMAP.md).

<br/>

**[ 🚀 Getting Started ](docs/manual/getting-started.md)** ·
**[ 📖 Manual ](docs/manual/game-manual.md)** ·
**[ 🧠 Strategy ](docs/manual/strategy-guide.md)** ·
**[ 🧬 Codex ](docs/manual/strain-codex.md)** ·
**[ 🪙 Token ](docs/manual/tokenomics.md)** ·
**[ 🛸 Lore ](docs/manual/lore.md)**

<sub>GrowPod Empire · MIT Licensed · Made among the stars 🌌</sub>

</div>
