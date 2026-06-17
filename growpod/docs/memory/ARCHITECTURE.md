# Architecture & Invariants (Layer 1)

The load-bearing map of GROWv2. If you're about to change something here, you're changing the
foundation — record *why* in `DECISIONS.md` and confirm the invariants still hold.

This is "where we are." For "where we're going" (the moat, the scientist-grade sim & generative
genetics targets, the trust layer) see the **Design Codex** at `docs/memory/design/README.md`, and
`docs/memory/MAP.md` for the master code↔doc index and build-state dashboard.

## System map

```
                    web/ (Next.js 15, App Router, TS, Tailwind, React Query)
                      │  polls GET .../state ; API-key in header
                      ▼
  api/  ── flask_api ─┬─ game_api (routes)        auth · ratelimit · errors · validation
                      │                            observability · openapi · serialize
                      ▼
  services/  ── orchestration layer (player-scoped, NOT pure) ───────────────────────────┐
   game_service · simulation_service · settlement_service · minting_service               │
   research_service · contract_service · leaderboard_service · weather_service            │
   leveling_service · progression_service · advisor_service · autocare_service            │
                      │                 │                 │                 │              │
                      ▼                 ▼                 ▼                 ▼              │
  simulation/      economy/         genetics/          chain/            ai/              │
  (PURE engine)    (ledger,         (traits,           (ABC provider:    (ABC provider:   │
  clock·engine·    pricing,         breeding,          mock + algorand,  mock + claude,   │
  horticulture·    config —         deterministic      factory)          autocare,        │
  reactions·       Decimal money)   crossbreeding)     TREASURY sentinel factory)         │
  conditions·curing  (engine reads light + derived VPD/DLI — Phase A)                      │
                      └───────────────────── db/ (SQLAlchemy models · Alembic · seed) ◄────┘
                                              data/ balance.yaml · strains.yaml (tuning)
```

## Module boundaries (who may depend on whom)
- `api/` → `services/` only. Routes do no business logic beyond shaping requests/responses.
- `services/` → everything below. This is the **only** place player-scoped economy/research/auth
  logic lives.
- `simulation/` depends on nothing project-specific except `enums`/config. **It must stay pure**
  so it's deterministic and testable. Player perks (research, consumables) are applied *around* it
  in services, never *inside* it.
- `chain/` and `ai/` are pluggable provider packages: an ABC + `mock` + real impl + `factory`.
  Config picks the impl. Mocks are deterministic and used by CI.

## Invariants — the "don't break" list
1. **DB is the source of truth; the chain mirrors it.** ASA balance / NFT state is settlement, not
   gameplay truth. Gameplay must work with the mock chain.
2. **Simulation is compute-on-read and deterministic.** State is derived from elapsed time + stored
   inputs (lazy catch-up). Same inputs ⇒ same outputs. No wall-clock randomness without a seed.
3. **All money is `Decimal` and ledger-posted.** No floats for currency. Every economic effect has a
   ledger entry. Every faucet has a sink (inflation guard). **Concurrency-safe (2026-06-10):** the
   wallet uses optimistic locking (`version_id_col`) + a `CHECK(cached_balance >= 0)` backstop, and a
   plant is harvested once (`uq_harvests_plant`) — so concurrent debits/harvests can't double-spend
   or double-mint; a lost race rolls back as a 409. Don't reintroduce check-then-act on money rows.
4. **Server is authoritative.** No client-trusted state. Spending paths go through guards
   (e.g. `SpendGuard` caps the AI auto-care budget per invocation).
5. **Writes are authenticated + rate-limited; reads are public.**
6. **CI never needs a live key.** `USE_MOCK_AI` / no `ANTHROPIC_API_KEY` ⇒ mock advisor & auto-care;
   mock chain ⇒ no TestNet needed.
7. **Balance is data, not code.** Tune in `balance.yaml`; the engine reads it.
8. **Migrations are forward-only and tested.** `alembic upgrade head` runs in CI.
9. **Randomness is seeded, so outcomes are provably fair.** Every cross, weather roll, and sim step
   draws from a recorded/derived seed (`BreedingEvent.rng_seed`, `engine._rng_for`). A bred strain
   can be replayed and verified by anyone via `GET /strains/<id>/provenance`
   (`services/game_service.py:verify_strain`). Don't introduce unseeded randomness on any gameplay
   path.

## Known structural risks (watch these)
- **Sim cost per read is bounded** (fixed 2026-06-10): one catch-up simulates at most
  `simulation.max_catchup_hours` (balance.yaml); a longer absence becomes recorded `dormancy`
  (state + stage clock pause, then the plant lands at `now`), so a derelict plant costs one cap
  window **once**, not per read. Residual watch: many derelict plants hitting their first read in
  the same request burst; background materialization remains the at-scale answer.
- **Custodial key custody** (treasury/ASA, future player keys): must be encrypted at rest /
  secrets-manager only before any real value moves. Today it's TestNet/mock.
- **Minting is still mock / not wired to a funded TestNet ASA** (`ASA_ID` unset; metadata not on
  IPFS). The abstraction is real; the live wiring is not.
