# Phase 1 — Database, Economy, Strains & Crossbreeding

This phase turns GrowPodEmpire from an in-memory tracker into a persistent game
with a real economy, a genetics-backed strain catalog, and crossbreeding. It is
the foundation for the real-time grow simulation (Phase 2) and the Algorand
on-chain ASA/NFT layer (Phase 3).

## What's new

| Area | Module | Notes |
|------|--------|-------|
| Persistence | `growpodempire/db/` | SQLAlchemy 2.0 ORM, Alembic migrations. SQLite locally, Postgres on Render. |
| Economy | `growpodempire/economy/` | Append-only currency **ledger** (source of truth) + pure **pricing** formulas. Money is `Decimal`, never float. |
| Genetics | `growpodempire/genetics/` | Deterministic, seedable **crossbreeding** engine (`cross()`), trait inheritance with dominance + segregation variance. |
| Catalog | `data/strains.yaml` + `db/seed.py` | 16 starter strains, idempotently seeded. |
| Tuning | `data/balance.yaml` | All economic constants live here — no hardcoded numbers. |
| API | `api/game_api.py` (`/api/game/*`) | Players, wallets, strains, seeds, planting, breeding, harvest, marketplace, ledger. |

The legacy in-memory cultivation endpoints (`/api/pods`, `/api/plants`,
`/api/environment`, …) are unchanged and still served by the same app; they are
slated to migrate onto the DB in a later pass.

## Run it locally

```bash
pip install -r requirements.txt

# Create the schema and seed the strain catalog (SQLite by default).
alembic upgrade head
python -m growpodempire.db.seed        # idempotent

# Serve the API (legacy + game endpoints).
python server.py                       # http://localhost:10000

# Tests
pytest
```

Set `DATABASE_URL` to point at Postgres in production (Render injects it). The
in-game currency (`GROW`) is stored at 6 decimals so it can later map 1:1 to an
Algorand ASA.

## Economy model (sources vs sinks)

* **Faucets:** starting grant (500 GROW), daily stipend, harvest sales.
* **Sinks (fight inflation):** seed/nutrient/pod purchases, breeding fees,
  marketplace listing fees and sale taxes (the tax is *burned*).
* Harvest value scales non-linearly with quality, with strain rarity and THC,
  and has diminishing returns above a weight soft-cap. Tune everything in
  `data/balance.yaml`.

## Crossbreeding

`cross(parent_a_genome, parent_b_genome, rng, ...)` is deterministic for a given
`random.Random` seed (the seed is stored on each `BreedingEvent` for replay).
Each trait blends the parents by dominance, then adds bounded Gaussian variance
scaled by parental instability — so stable lines breed true and unstable crosses
segregate. Offspring stabilize over generations and can climb rarity tiers,
which will gate NFT minting in Phase 3.

## Key example flow

```
create player        -> +500 GROW (starting_grant)
buy a seed           -> -25  GROW (seed_purchase)
plant the seed       -> genome copied onto the plant
breed two strains    -> -75  GROW (breeding_fee), new strain + 1 seed
harvest & sell       -> +232 GROW (harvest_sale)
```

Every movement is one append-only `ledger_entries` row with a `balance_after`
snapshot, so balances are always auditable and reconcilable against the future
on-chain ASA.
