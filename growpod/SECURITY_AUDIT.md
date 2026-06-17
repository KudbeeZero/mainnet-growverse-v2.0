# GROWv2 Security Audit

_Date: 2026-06-07 · Scope: Flask/SQLAlchemy backend + API, Next.js (desktop/web) client, economy, on-chain settlement._

This audit reviewed the game for ways an attacker could break in or manipulate
state/economy, and added safeguards for the critical and high findings. Each
finding lists severity, location, impact, and the remediation status.

Legend: ✅ Fixed in this change · 📝 Documented / accepted risk

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| 1 | Critical | Client-controlled harvest value | ✅ |
| 2 | High | Deterministic RNG "seed-shopping" | ✅ |
| 3 | High | Wide-open CORS (`*`) | ✅ |
| 4 | High | IDOR on player-scoped reads | ✅ |
| 5 | High | No rate limiting / brute-force protection | ✅ |
| 6 | High | Treasury / withdrawal abuse surface | ✅ |
| 7 | Medium | Unvalidated numeric input → 500s / abuse | ✅ |
| 8 | Medium | Legacy unauthenticated in-memory endpoints | ✅ |
| 9 | Medium | Web token in localStorage + missing security headers | ✅ / 📝 |
| 10 | Low | Hardening & hygiene | ✅ / 📝 |

---

## 1. [CRITICAL] Client-controlled harvest value → unlimited currency
**Where:** `api/game_api.py` harvest route → `services/game_service.py:harvest_plant`.
**Impact:** The harvest endpoint accepted `weight_g` and `quality` from the
request body and fed them into the sale-value formula, so a player could
`POST {"weight_g": 999999999, "quality": 100}` and mint unlimited GROW —
breaking the entire economy.
**Fix:** The route no longer reads `weight_g`/`quality` from the client. Yield
weight and quality are always computed **server-side** from the plant's
simulated health and the strain's genetics (the existing formula in
`harvest_plant`). Only the `sell` flag remains client-controlled. The web client
(`web/src/lib/api/plants.ts`) was updated to match.
**Test:** `tests/test_security.py::test_harvest_value_is_server_authoritative`.

## 2. [HIGH] Deterministic RNG "seed-shopping"
**Where:** breed / stabilize / weather / contract-offer routes in `api/game_api.py`.
**Impact:** These routes accepted a client-supplied `rng_seed` (and weather also
accepted an explicit `event`). Because outcomes are deterministic in the seed, a
player could grid-search for ideal offspring, force "ideal" weather, or pull the
most lucrative contracts.
**Fix:** The routes no longer accept `rng_seed` (or a chosen weather `event`).
Seeds are generated server-side (`random`/`secrets`-backed) and still persisted
for reproducibility/audit. The web client and the `WeatherRoller` UI were updated
to remove the event/seed pickers.
**Test:** `tests/test_security.py::test_weather_event_cannot_be_chosen`.

## 3. [HIGH] Wide-open CORS
**Where:** `api/flask_api.py` — `CORS(app)` allowed every origin.
**Impact:** Any website could call the API from a victim's browser.
**Fix:** CORS is now restricted to an explicit allowlist
(`CORS_ALLOWED_ORIGINS`, default `http://localhost:3000`), scoped to `/api/*`,
with methods/headers limited to what the API uses (incl. `X-API-Key`).
**Tests:** `test_cors_allows_configured_origin`, `test_cors_blocks_unlisted_origin`.

## 4. [HIGH] IDOR / data exposure on read endpoints
**Where:** wallet, ledger, player, seeds, pods, plants, plant-state, favorites,
achievements, contracts GETs in `api/game_api.py`.
**Impact:** These player-scoped reads were unauthenticated, so anyone could read
any player's balance, full transaction history, and inventory by enumerating
`player_id`.
**Fix:** All player-scoped sensitive reads now require the player's API key via
the existing `@require_player` guard (constant-time key compare). Genuinely
public data (strain catalog, leaderboards, market listings, NFT metadata, level)
stays open. The web client sends the key on these reads (`auth: true`).
**Tests:** `test_protected_read_requires_key`, `test_cannot_read_another_players_data`,
`test_public_reads_stay_open`.

## 5. [HIGH] No rate limiting / brute-force protection
**Where:** entire API.
**Impact:** API keys were brute-forceable and faucet/spam endpoints unbounded.
**Fix:** Added Flask-Limiter with a global default (`240/min`, configurable) and
tighter caps on faucet/abuse-prone routes (player creation `30/h`, daily claim
`30/h`, contract offer `60/h`). Requests are keyed by client IP — deliberately
**not** by the supplied API key, so a brute-forcer varying the guessed key can't
escape the limit. `ProxyFix` is enabled so the real client IP is used behind
Render's proxy. In-memory storage by default; set `RATELIMIT_STORAGE_URI` to
Redis in production.
**Test:** `test_player_creation_is_rate_limited`.

## 6. [HIGH] Treasury / withdrawal abuse surface
**Where:** `api/game_api.py` wallet withdraw/deposit → `services/settlement_service.py`.
**Impact:** Withdrawals signed by the treasury mnemonic accepted a raw client
`amount`; a stolen key could drain a wallet in one call.
**Fix:** `amount` is validated as a positive, bounded `Decimal` at the route, and
`SettlementService.withdraw` enforces a rolling-24h per-player withdrawal cap
(`MAX_WITHDRAWAL_PER_DAY`, default 10,000; a cap violation rolls back the debit).
The treasury mnemonic is read only from env (`config.py`) and never logged or
serialized.

## 7. [MEDIUM] Unvalidated numeric input
**Where:** quantity / price / bid / amount / capacity / duration / limit params.
**Impact:** Raw `int()`/value coercion threw on bad input (surfacing as generic
500s), and zero/negative/huge values could reach business logic.
**Fix:** Added `api/validation.py` (`positive_int`, `bounded_int`,
`positive_money`) applied across the routes, returning clean 400s and enforcing
sane bounds.
**Test:** `test_negative_quantity_is_400_not_500`, `test_non_numeric_amount_is_400`.

## 8. [MEDIUM] Legacy unauthenticated in-memory endpoints
**Where:** old cultivation routes (`/api/pods`, `/api/plants`, `/api/environment`,
`/api/blockchain`, `/api/stats`).
**Impact:** Fully unauthenticated, threw 500s on missing fields, and operated on
a separate in-memory store that bypasses the economy.
**Fix:** Extracted to `api/legacy_api.py` and gated behind `ENABLE_LEGACY_API`
(default **off**). They are also hardened (safe JSON parsing, 400s instead of
500s) for the demo case where they're enabled.

## 9. [MEDIUM] Web token storage + missing security headers
**Where:** `web/src/lib/api/client.ts` (API key in `localStorage`); `web/next.config.mjs`.
**Impact:** No HTTP security headers; XSS could exfiltrate the API key.
**Fix:** Added a strict `Content-Security-Policy` plus `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, and
HSTS in `next.config.mjs`. The CSP limits scripts to same-origin and network
calls to self + the configured API origin, which is the primary XSS mitigation.
**📝 Accepted risk:** the key remains in `localStorage` for now. Because auth uses
a custom `X-API-Key` header (not a cookie), it is not CSRF-exploitable; the
residual risk is XSS, mitigated by the CSP. A future hardening step is to move to
an httpOnly, SameSite cookie session.

## 10. [LOW] Hardening & hygiene
- `FLASK_DEBUG` already defaults off; unexpected exceptions return a generic 500
  with no stack trace leak (`api/errors.py`) — verified.
- 1 MiB request-body cap already present (`api/errors.py`) — verified.
- Added `SECURITY.md` with a disclosure contact.
- `.env*` is git-ignored; secrets are env-only. **📝 Recommended:** run GitHub
  secret scanning / `git log` review periodically to confirm none were committed.

---

## Residual risks & recommendations
- **Session model:** consider migrating the web client from a localStorage API
  key to an httpOnly cookie session (see #9).
- **Rate-limit storage:** set `RATELIMIT_STORAGE_URI` to Redis in production so
  limits are shared across instances/workers (in-memory is per-process).
- **Account-level abuse:** IP-based limits don't stop a single account abusing
  faucets across many IPs; add per-account caps if this becomes a problem.
- **Dependency hygiene:** enable Dependabot / `pip-audit` and `npm audit` in CI.

## Verification
- Backend: `python -m pytest -q` (includes `tests/test_security.py`).
- Web: `npm run lint && npm run typecheck && npm run build` in `web/`.
- Snapshot: `python -m growpodempire.scripts.snapshot` (see `SECURITY.md` /
  `.github/workflows/snapshot.yml`).
