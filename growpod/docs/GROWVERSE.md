<div align="center">

# 🌱 GrowVerse — Start Here (canonical index + current truth)

*The single current entry point. If you read one doc, read this. It says what the
game is **today**, where it's **going**, and where every other doc lives — because
the docs are scattered across the repo and Notion and several are stale.*

**Last updated:** 2026-07-06 · maintained as the top of the documentation map.

</div>

---

## 0. Naming — one name, going forward

The project has been called, at various times: **GrowPod Empire**, **GROVERS**,
**Ascendancy / FRONTIERNeXt**, **Frontier‑AI**. The current, canonical name is
**GrowVerse** (package still `growpodempire` internally). Chain is **Algorand** —
any doc that says **Solana** (e.g. the 2025 "GROVERS White Paper" in Notion) is
**stale**. When docs disagree with this file or the code, the code wins.

## 1. What GrowVerse is (today, true)

A cannabis‑growing game with a real horticulture simulation, real strain
genetics + crossbreeding, a ledgered in‑game economy, an Algorand on‑chain asset
layer (testnet/mock today), and AI advisors. **The core loop works and is
tested:** grow → care → harvest → cure → sell / breed / stabilize → (mint) →
trade. Backend is Python/Flask; web is Next.js 15. DB is authoritative; the chain
mirrors it. Randomness is seeded and provably fair.

## 2. The vision we're building toward — the asset economy

*(owner direction, 2026‑07‑06. This is design intent, not all shipped yet.)*

**The NFT is born at the seed** — the seed carries the genome, rarity, and the
recorded RNG seed; everything downstream is derived from it (this is already how
the engine works). Its metadata **evolves as it grows** (seed → plant → harvest)
via Algorand dynamic metadata.

The lifecycle loop:

**Seed → Plant → Harvest → Jar (cure = staking) → Bud cards → Lab / Market →
Breeding → new Seed.**

- **Cure = staking.** The harvest becomes a visual "jar" NFT; curing it is
  staking. Real curing has a sweet spot (over‑curing degrades) — so the
  "too much of a good thing is bad" risk curve is built into the fiction.
- **Buds become cards.** The cured flower is a tradeable card. You can buy one,
  take it to the **Lab** and examine it (find rare traits — this is the trichome
  microscope we already have), **breed** with its genetics, or **"smoke" it**
  (consume the card for a one‑time effect — a clean sink). Keep‑vs‑consume is
  what gives the market depth.
- **Breeding is the payoff** — rare traits found in the lab feed better crosses.
  The **Breeding Lab needs a full arcade redesign** (it's boring today).
- **Rooms are decoratable + terraformable.** Removing clutter over the plant
  frees the floor for **sellable cosmetic decor** (lava lamp, lights, posters,
  a trophy shelf tied to your real Cup/breeding wins) and **terraforming**
  (swap floor/wall/theme). Rendering direction: **2.5D layered diorama** (chosen
  2026‑07‑06 over full 3D — cheaper, not under the 3D freeze, unlocks decor).
- **Treasury** underpins fees / mint proceeds. *Design it now; do not operate it
  until custody + legal are locked down.*

### Green light vs. hard line
- **Safe to build/spec now (no real money):** the whole lifecycle *design*, the
  Breeding Lab arcade redesign, lab examination + rare‑trait discovery, decor +
  terraforming, and **off‑chain / testnet** prototypes of cure‑staking + cards on
  the soft in‑game currency. Make the loop fun and provably fair with zero real
  value at risk.
- **Hard‑gated (owner + legal, never the agent alone):** treasury **operation**
  (custody/keys/multisig), staking that pays **real** value, cards tradeable for
  **real** money, mainnet, and any token‑market/liquidity step. Tokenomics that
  create a tradeable, speculatable token collide with the project's own
  "fun first, speculation never" principle and with securities / money‑transmitter
  / gambling law — decide it deliberately, with counsel. See `ROADMAP` phases 7,
  8, 13, 20, 22 and "What NOT to build yet."

## 3. Where the documentation actually lives

### In this repo
| Where | What | State |
|---|---|---|
| `docs/manual/` | **Player manual suite** — `game-manual.md` (701 lines, 18 systems), `getting-started.md`, `strategy-guide.md`, `strain-codex.md`, `tokenomics.md`, `lore.md`, `glossary.md` | ⚠️ **stale** (last touched 2026‑06‑25); uses old "GrowPod Empire / orbital greenhouse" framing and describes a live token price ticker that is **not** live |
| `docs/encyclopedia/` | Per‑strain encyclopedia + render pipeline (`INDEX`, `SCHEMA`, `RUNBOOK`, `_render.py`, `strains/`) | ⚠️ stale (2026‑06‑25) |
| `docs/memory/` | **Developer memory layer** — `CLAUDE.md` (identity/invariants), `ARCHITECTURE.md`, `ARCHITECTURE_TRUTH.md`, `GROWVERSE_ROADMAP.md` (22‑phase plan), `EXECUTION_MACHINE.md`, `DECISIONS.md`, `BACKLOG.md`, design codex `design/00`–`12`, `INCIDENTS.md` | ✅ current (this is the live source of truth for building) |
| `docs/` (root) | Build rules, deploy, QA, phase specs, `ROADMAP.md`, `HANDOFF.md` (the session baton), safety/evidence layers | mixed — memory layer supersedes the older 00–09 numbered specs |
| in‑app | `/guide` route + **HERMES University** (in‑game teaching) | live |

### In Notion (scattered whitepapers / hubs — mostly stale or superseded)
- **GrowPod Empire — TestNet Guide, Status & Monitoring Hub** (2026‑06‑14) — points back at `docs/manual/`.
- **Ascendancy — Game Architecture & Development Docs**, **Ascendancy FRONTIERNeXt — Whitepaper & Strategy Hub**, **Frontier‑AI v1.3 Whitepaper**, **Game Infrastructure** (2026‑06) — architecture/whitepaper material under old names.
- **🌱 GROVERS White Paper** (2025) — ⚠️ says "built on **Solana**"; superseded (we're on Algorand).
- **Why Grovers Revolted** (2025) — lore.

**The real problem isn't "no docs" — it's too many, scattered, stale, and under
inconsistent names, with no single current source of truth.** This file is that
source of truth until the manual is refreshed.

## 4. Recommended cleanup (queued, not yet done)
1. Refresh `docs/manual/` to GrowVerse framing + the current core loop + this
   vision; retire the "orbital greenhouse / Solana / live price ticker" language.
2. Formalize §2 into the design codex (`design/13-asset-economy.md`) and register
   it in `docs/memory/MAP.md`.
3. Consolidate the Notion whitepapers into one current hub (or point them here);
   flag the Solana whitepaper as archived.
4. Keep this file at the top of the map and update it when direction changes.

---

*This doc was created to answer "do we have any documentation?" — we have a lot;
this is the current, honest index of it.*
