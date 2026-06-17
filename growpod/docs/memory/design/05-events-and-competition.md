# 🏆 Events & Competition — the seasonal Cannabis Cup

> The deep design for LiveOps competition: a **seasonal Cannabis Cup** whose winners earn *lifetime*
> prestige — a one-of-a-kind legendary trophy strain and a permanent title. This is where the moat's
> **discovery economy (#5)** and **mastery-as-the-gate (#6)** become a recurring, social endgame.
> Tags: ✅ built · 🔨 partial · ⬜ planned.

## Why a competition
The grow loop makes *good* flower; the Cup answers "**whose is best?**" — a recurring, social,
high-stakes reason to chase the perfect phenotype. It turns the genetics + cultivation depth into
prestige, and it's the natural home for the "rare realities that are lifetime" idea: the things you
win here you keep **forever**.

## How it works today ✅
Shipped backend (`services/cup_service.py`, `economy/pricing.py:cup_score`, `api/game_api.py`,
`data/balance.yaml:cannabis_cup`):

- **Seasonal editions.** One Cup runs per season — `edition = "<year>-<season>"` (e.g.
  `2026-summer`), keyed off the existing `events.current_season` LiveOps knob. When the season is
  `all`, the edition is `<year>-annual`. Tying the Cup to the season rotation means a fresh champion
  every season.
- **Lazy lifecycle (compute-on-read).** The current Cup opens on first access and **auto-judges when
  its window closes** — no cron, consistent with the sim's compute-on-read ethos. Idempotent: a Cup
  judges exactly once.
- **Enter.** A player submits an *unsold* harvest for a GROW **entry fee** (a sink → the prize pool);
  max entries per player is capped. Each entry's **score is snapshotted immutably** at submission.
- **Deterministic judging.** `cup_score` is a pure judge's scorecard over the harvest's snapshotted
  attributes — quality (cure/health), THC, terpene expression, a little yield — times a **rarity
  prestige multiplier**. No randomness → an entry's score is reproducible and verifiable, honoring
  the determinism invariant (ARCHITECTURE #9).
- **Prizes** (a bounded faucet, gated by the entry-fee sink + real grow effort): GROW to 1st/2nd/3rd
  and the rest of the top-N, plus XP. Tuned entirely in `balance.yaml`.

## The lifetime unlocks ✅ — "rare realities that are lifetime"
The champion's rewards are **permanent**, not consumable:
- **A one-of-a-kind legendary trophy strain.** A commemorative `LEGENDARY` strain minted from the
  *winning genetics* (the winning strain becomes its `parent_a_id`, so it sits in the lineage graph),
  created by the winner, and a seed of it dropped into their inventory. It is genuinely scarce — one
  per Cup, forever.
- **A permanent title.** `Player.cannabis_cup_title` (e.g. "Summer 2026 Cannabis Cup Champion") — a
  lifetime badge surfaced on the player.
- **The Hall of Fame.** Every season's champion is recorded permanently
  (`GET /cup/hall-of-fame`) — an immutable lineage of winners.

## API ✅
Public reads: `GET /cup/current` (live standings, auto-judges if closed), `GET /cup/<id>/standings`,
`GET /cup/hall-of-fame`. Authed write: `POST /players/<id>/cup/enter`.

## Where it's going ⬜
- **The trophy as an NFT.** Mint the champion strain on-chain (Proof-of-Cultivation + GenBank,
  `02-genetics.md`) so the lifetime prize is provably scarce and tradeable — gated on Sprint 4 (chain
  is mocked).
- **Discovery-economy hooks.** First-of-its-phenotype bonuses, judged terpene-cluster categories
  (per the research: terpinolene/myrcene/limonene-caryophyllene — `docs/research/2026-06-08-cannabis-strain-genetics-and-cultivation.md`),
  and named-cut prestige.
- **Skill/equipment tie-in.** Cup standing feeds grower reputation (`03-grower-skills.md`); judged
  categories reward specialization.
- **The constellation.** Render the Hall of Fame + champion lineages in the genetic-constellation
  visual language (`00-game-vision.md`) — a galaxy of champions. `web/` phase, ⬜.

## Invariants honored
- **Deterministic + server-authoritative scoring** (no client-submitted scores; pure `cup_score`).
- **Faucet has a sink** (entry fee ↔ prizes); prizes are bounded and effort-gated.
- **DB authoritative**; the on-chain trophy is a future mirror, never the source of truth.
- **Money is `Decimal`, ledgered** (`CUP_ENTRY_FEE` sink, `CUP_PRIZE_PAYOUT` faucet); the ledger is
  the idempotency guard against double-payout.

## Cross-links
- The genetics the trophy commemorates: `02-genetics.md`. · The mastery it feeds: `03-grower-skills.md`.
- The discovery-economy moat it advances: `00-game-vision.md` §The Moat #5/#6.
