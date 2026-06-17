# Simulation Test Clock (DEV/TEST ONLY)

A controllable clock that fast-forwards grow time so the full grow loop
(grow → care → harvest) can be exercised in seconds instead of real days.
It exists to unblock **STEP 4 (e2e grow-loop testing)** and launch-readiness
checks. It is **dev/test only** and can never run in production.

## Why it's safe

The simulation engine is **compute-on-read**: a plant's state is a pure function
of its stored state and `clock.now()` (see `simulation/engine.py`). The test
clock is just an `OffsetClock` — wall time plus a mutable, **forward-only**
offset — layered on the existing `Clock` seam. Advancing it makes the *next*
read of any plant run the normal catch-up. Nothing about the simulation math
changes.

- **No economy impact.** Advancing time only triggers `engine.catch_up`, which
  posts **no ledger entries** and changes no prices, faucets, or sinks. Money is
  untouched. (Guarded by `tests/test_test_clock.py::test_advance_does_not_touch_the_economy`.)
- **Never in production.** The feature is enabled only when
  `GROW_TEST_CLOCK=true` **and** `APP_ENV` is not `production`/`prod`. The
  `/api/dev/clock` blueprint is registered only when enabled, and every handler
  re-checks the flag (defence in depth → 404 otherwise).
- **Forward-only.** A backward jump would put `now()` behind a plant's persisted
  `last_tick_at` and desync the stage clock, so `advance` rejects negatives.
- **Bounded.** A single advance is capped at one engine catch-up window
  (`MAX_ADVANCE_HOURS = 8760` = 365 days).

## Enabling it

```bash
export APP_ENV=development      # anything except production/prod
export GROW_TEST_CLOCK=true
make serve
```

When disabled (the default everywhere, including CI), `active_clock()` returns a
plain `SystemClock` and the engine behaves exactly as before.

## Endpoints

All under `/api/dev` and present only when enabled.

| Method | Path | Body | Effect |
|--------|------|------|--------|
| GET  | `/api/dev/clock`         | —                          | Report offset, wall time, and effective (shifted) now. |
| POST | `/api/dev/clock/advance` | `{"hours": N}` / `{"days": N}` (>0) | Push the offset forward, then sync all living plants. Returns status + `synced_plants`. |
| POST | `/api/dev/clock/reset`   | —                          | Reset the offset to zero (effective clock returns to wall time). |

Example: drive a seed to flowering in one call.

```bash
curl -X POST localhost:5000/api/dev/clock/advance -H 'Content-Type: application/json' -d '{"days": 40}'
# then read the plant's state — it has caught up
curl localhost:5000/api/game/players/$PID/plants/$PLANT/state -H "X-API-Key: $KEY"
```

## Resetting / rollback

`POST /api/dev/clock/reset` rewinds only the **clock**, not the plants — time
already simulated is persisted (compute-on-read really advanced them). To fully
reset state, reseed the dev database. After a reset, plants freeze until wall
time catches up to where they were last ticked.

## Code map

| Piece | Location |
|-------|----------|
| `OffsetClock`, `get_test_clock`, `reset_test_clock`, `active_clock` | `src/growpodempire/simulation/clock.py` |
| Config gating (`APP_ENV`, `test_clock_enabled`) | `src/growpodempire/config.py` |
| Default clock resolution | `src/growpodempire/services/simulation_service.py` |
| Dev endpoints | `src/growpodempire/api/dev_api.py` |
| Conditional registration | `src/growpodempire/api/flask_api.py` |
| Tests | `tests/test_test_clock.py` |
