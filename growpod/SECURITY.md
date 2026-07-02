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

**Not yet automated** (corrected 2026-07-02 — this section previously claimed a
scheduled `.github/workflows/snapshot.yml`, which never existed). The snapshot
tool is `src/growpodempire/scripts/snapshot.py`, runnable by hand; scheduling it
is tracked in `docs/memory/BACKLOG.md` (security follow-ups). When automated,
snapshots must go to private object storage with scoped credentials — NOT
GitHub workflow artifacts, which would expose player data to anyone with repo
read access.
