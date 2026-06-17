# 🔍 Honesty & Provable Fairness — the trust layer

> A proprietary design pillar: make **honesty a player-facing feature**, not just an internal value.
> The insight that the new Claude models lean into — calibrated confidence, no fabrication, admitting
> uncertainty, verifiable claims — becomes a *product surface* here. Tags: ✅ built · 🔨 partial ·
> ⬜ planned. This extends the moat in `00-game-vision.md`.

## Why honesty is a feature, not a policy
GROWv2 lives in the worst neighbourhood for trust: games with economies + NFTs, a space drowning in
rug-pulls, rigged drops, hidden house edges, and pay-to-win obfuscation. **"Provably honest" is a
genuine wedge** — the anti-scam game in a category that has trained players to expect scams. And the
remarkable part: **we already built most of the trust primitives for engineering reasons.** Turning
them into a player-facing promise is nearly free leverage.

The same ethos already runs the *developer* memory system — current-state tags (✅/🔨/⬜),
append-only decisions, the "docs can never lie again" rule. This doc pushes that honesty discipline
**out of the repo and into the product.**

## The insight — the trust primitives already exist
| Primitive | What it gives | State today |
|-----------|---------------|-------------|
| **Deterministic, seeded sim** | Every outcome is *replayable* — re-run the seed, get the same result | ✅ `simulation/engine.py:_rng_for` (SHA256 of plant-id + hour) |
| **Persisted breeding seed** | Every genetic cross can be *re-derived and verified* | ✅ `BreedingEvent.rng_seed` (`db/models.py`) |
| **Double-entry-ish ledger** | Every GROW movement is *auditable*; faucets ↔ sinks tracked | ✅ `economy/ledger.py`, property-tested |
| **Structured AI advisor** | Diagnoses come back as inspectable, typed outputs (not freeform) | 🔨 `services/advisor_service.py` |
| **On-chain provenance** | Asset history *provable* by a third party | ⬜ chain mocked (Sprint 4) |

We have determinism, an audit ledger, and persisted seeds **right now**. The trust layer is mostly
about *exposing and proving* what's already true.

## The five trust pledges
1. **Provably-fair RNG.** 🔨 Every random draw — genetics segregation, mutation, weather, drops,
   discovery — is seeded and the seed is disclosed, so a player (or a third party) can **replay and
   verify** the outcome. No rigged drops, no secret weighting. **Shipped for breeding:**
   `GET /strains/<id>/provenance` re-derives a bred strain's genome from its persisted `rng_seed` and
   confirms it matches (`services/game_service.py:verify_strain`) — anyone can replay the cross. The
   API even refuses a client-supplied seed at breed time (anti seed-shopping). *Next:* generalize the
   same replay to sim / weather / discovery draws.
2. **A transparent economy.** 🔨→⬜ Publish faucets vs sinks and the live inflation picture from the
   ledger. No hidden money printing; the burn is visible. The data exists in `economy/ledger.py`;
   the public-facing transparency view is the work.
3. **An honest AI Master Grower.** 🔨 The advisor states **calibrated confidence**, cites the state
   it reasoned from, and **admits uncertainty** rather than fabricating a diagnosis — the same
   honesty that makes the model trustworthy, made visible in-game. It tags its own advice the way
   this codex tags capabilities.
4. **No dark patterns — a published charter.** ⬜ Explicit, enforced commitments: disclosed odds, no
   loot-box manipulation, no manufactured FOMO, no pay-to-win obfuscation. Written down, versioned,
   and testable.
5. **Verifiable provenance.** 🔨 Proof-of-Cultivation + the GenBank (`02-genetics.md`) let anyone
   verify an asset's full history — authorship, lineage, and the conditions it was grown under.
   **Shipped:** `GET /strains/<id>/lineage` replays a strain's entire ancestry from persisted seeds.
   *Remaining (⬜):* genome fingerprint + on-chain settlement (chain is mocked). Honesty about *where
   a thing came from*.

## "Building right beside you" — co-evolution with the model line
The in-game AI's honesty and capability are **versioned against the Claude model line and logged in
the open.** As the models get more honest and more capable, the Master Grower does too — and that
progression is a transparent, dated record (a living "advisor charter"), not a silent swap.
- A **model/capability changelog** for the advisor: which model, what it can advise on, where it
  defers — tagged ✅/🔨/⬜ like everything else here.
- The honesty stance is **provider-agnostic at the seam** (the `ai/` ABC) but the *charter* travels
  with whatever model is wired, so trust is a property of the product, not a single vendor.
- This is the co-evolution story: the game's trustworthiness grows in lockstep with the model's,
  visibly, over time.

## How this impacts the game (the wedge)
- **Differentiation / marketing:** "the provably-honest grow game" is a one-line pitch in a category
  defined by mistrust. It's the headline a skeptical crypto-adjacent audience actually responds to.
- **Retention:** grows take real days and assets are long-lived (`03-grower-skills.md`); players
  only make that time investment if they trust the world isn't rigged. Trust *is* the retention
  mechanism here.
- **Regulatory tailwind:** disclosed odds + no dark patterns is increasingly *mandated* (loot-box
  legislation, consumer-protection rules). Being early is a durable moat, not just goodwill.
- **Feeds the data flywheel:** an advisor that admits uncertainty is *more* trusted → used more →
  generates more data → gets better (`00-game-vision.md` moat #7).
- **Compounds the existing moat:** determinism + ledger + provenance were built for gameplay
  correctness; reframing them as a *trust product* costs little and multiplies the value of work
  already done.

## What's real today vs planned — stay honest about the honesty layer
- ✅ Deterministic seeded sim; persisted breeding seed; auditable ledger; structured advisor outputs.
- ✅ **Provably-fair breeding verification** — `GET /strains/<id>/provenance` replays the cross and
  proves the genome matches (`verify_strain`, `tests/test_provenance.py`).
- ✅ **Verifiable pedigree** — `GET /strains/<id>/lineage` replays a strain's *whole ancestry* back
  to base-catalog roots (`verify_lineage`) — the provable family tree behind the GenBank.
- 🔨 Advisor confidence/uncertainty surfacing; public economy transparency view; generalizing
  "verify this result" beyond breeding (sim/weather/discovery).
- ⬜ The no-dark-patterns charter; on-chain provenance (gated on Sprint 4 — the chain is mocked, see
  `DECISIONS.md`); the advisor model/capability changelog.

> A trust layer that overstates itself defeats its own purpose. Every claim here is tagged; nothing
> ships to players as "provably fair" until a player can actually do the proving.

## Cross-links + anti-goals
- The provenance this builds on: `02-genetics.md` (Proof-of-Cultivation, GenBank).
- The AI flywheel it feeds: `00-game-vision.md` §The Moat #7.
- Invariants it must honour: determinism is sacred, money stays ledgered, DB authoritative
  (`00-game-vision.md` §Anti-goals + `docs/memory/ARCHITECTURE.md`). The trust layer *exposes* these
  invariants; it must never weaken them to look transparent.
