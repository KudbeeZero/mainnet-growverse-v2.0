# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in GROWv2, please report it privately so
it can be fixed before public disclosure.

- **Contact:** dominick.ziola@gmail.com
- Please include steps to reproduce, affected endpoints/files, and the impact.
- Do **not** open a public GitHub issue for security problems.

We aim to acknowledge reports within a few days and will keep you updated on the
fix. Please give us a reasonable window to remediate before any public
disclosure.

## Supported surface

GROWv2 consists of a Flask/SQLAlchemy API, a Next.js web client, and an Algorand
on-chain settlement layer. The economy is **server-authoritative** — game values
(yields, prices, RNG outcomes) are computed and validated on the server; the
client cannot set them.

## Hardening overview

See [`SECURITY_AUDIT.md`](./SECURITY_AUDIT.md) for the full audit. Key safeguards:

- Per-player API-key auth (constant-time compare) on all mutating and
  player-scoped read endpoints.
- CORS restricted to an explicit origin allowlist (`CORS_ALLOWED_ORIGINS`).
- IP-based rate limiting (Flask-Limiter) with tighter caps on faucet routes.
- Strict input validation and bounds on all numeric inputs.
- Rolling-24h per-player on-chain withdrawal cap (`MAX_WITHDRAWAL_PER_DAY`).
- HTTP security headers + CSP on the web client.
- Legacy unauthenticated endpoints disabled by default (`ENABLE_LEGACY_API`).

## Secrets

Secrets (e.g. `ALGO_TREASURY_MNEMONIC`, production `DATABASE_URL`) are read only
from the environment / host secret store and must never be committed. See
`.env.example` for the configurable variables.

## Backups

A daily snapshot of the database plus the balance/strain lookup tables is taken
for rollback and audit (`scripts/snapshot.py`, scheduled via
`.github/workflows/snapshot.yml`). Set a `DATABASE_URL` repository secret to
snapshot the production database; snapshots are uploaded as workflow artifacts
(30-day retention).
