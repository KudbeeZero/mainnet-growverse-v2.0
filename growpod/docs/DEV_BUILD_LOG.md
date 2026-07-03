# Developer Build Log — GROWv2 / GrowPod Empire

> **⚠️ HISTORICAL (Replit-era)** — this milestone plan was written when the project ran on Replit. It is superseded by `docs/HANDOFF.md` (live baton) and `docs/memory/BACKLOG.md` (priority backlog). Preserved as a record of the early planning.

A working, sequenced plan for taking the game from "running on Replit" to "launchable and
long-lived", **without breaking the core loop** (grow → care → harvest → cure →
sell/breed/stabilize → mint → trade).

- **Status keys:** `⬜ todo · 🔨 doing · ✅ done · ❄️ parked`.
- **Source of truth for priority** is `docs/memory/BACKLOG.md`; this file sequences that
  backlog into executable milestones with acceptance criteria. The flat shipping record is
  `BUILDLOG.md`. Always-loaded conventions/invariants are in `CLAUDE.md`.
- **Workflow:** develop here → push to the GitHub branch → pull into Replit to test live.

---

## Milestone 0 — Get live & stable on Replit (in progress)

Goal: a player can create an account, get a Player ID + API key, sign back in, and walk the
full loop on the live Replit URL.

- 🔨 **Fix "create account fails" on Replit.** The web client baked `http://localhost:10000`
  into the browser bundle when `NEXT_PUBLIC_API_BASE` was absent at build time. Now defaults
  to **same-origin relative URLs**, proxied to gunicorn by the Next rewrites.
  - *Files:* `web/src/lib/api/client.ts`.
  - *Accept:* with `NEXT_PUBLIC_API_BASE` empty/unset, `POST /api/game/players` from the
    browser returns a player + `api_key` (request goes same-origin → `BACKEND_URL`).
- 🔨 **Fix "I have a key" sign-in.** It read the key from `localStorage` (empty pre-login) and
  threw before contacting the server; the typed key was never used. Now the typed key is sent
  explicitly to validate, then the session is stored on success.
  - *Files:* `web/src/lib/api/client.ts`, `web/src/lib/api/players.ts`,
    `web/src/components/onboarding/OnboardingPanel.tsx`.
  - *Accept:* signing in with a valid Player ID + key lands on `/dashboard`; a wrong key shows
    "API key doesn't match this Player ID".
- 🔨 **Document the real Replit wiring** (`replit.md`): two-process topology, env table, and the
  three "won't connect" gotchas (build-time `NEXT_PUBLIC_*`, missing `[deployment].run`,
  30/hour create rate-limit).
- ⬜ **Confirm the autoscale deployment runs gunicorn, not just Next.** The `.replit`
  `[deployment]` block has only `postBuild`, no `run`. On the live deploy, hit
  `GET /health` (proxied) and `GET /api/game/strains`. If they 502, the backend isn't running
  — add a deployment `run` that starts both processes (e.g. a `scripts/replit-start.sh` that
  backgrounds gunicorn and foregrounds `next start`). *(Needs the Replit console — owner.)*
- ⬜ **Full-loop smoke on the live URL:** create account → buy/plant seed → care → harvest →
  cure → sell; breed two strains; check leaderboards/university/cup screens load.

---

## Milestone 1 — Make truth automatic & protect the loop (next 1–2 weeks)

From BACKLOG 🔴/🟠. Mostly about not regressing as we add features.

- ⬜ **Reconcile `docs/ROADMAP.md`** — Sprints 1–3 shipped but still show ⬜/🔨; verify exit
  criteria and update so planning reads an honest map.
- ⬜ **Retire/replace `docs/NEXT_SESSION_SPRINT3.md`** — stale handoff; fold anything live into
  this build log or delete.
- ⬜ **Idempotency keys on mutations** — accept a client key on write endpoints; dedupe so a
  retry/double-submit can't double-post to the ledger. *Accept:* a property test proving a
  repeated request with the same key posts once.
- ⬜ **Sim cost cap** — bound the compute-on-read catch-up in `simulation/` so a long-dormant
  plant can't cause an unbounded tick loop on the next `/state` read; batch/materialize.
  *Accept:* a test asserting bounded work for a multi-week gap.
- ⬜ **Load/soak `/state`** — find the cost knee before players do; record numbers here.
- ⬜ **Restore test tooling stripped for the prod build** — Replit removed `@playwright/test`
  and `vitest` from `web/package.json` (and `web/package.json` `test*` scripts are now stubs),
  but the backlog marks the Vitest + Playwright suites as shipped. Decide: restore as
  devDependencies (kept out of the prod bundle) so web CI can run them again, or formally park
  them. *Accept:* `cd web && npm run typecheck && npm run lint` green; e2e/unit either runnable
  or explicitly parked in this log.

---

## Milestone 2 — Real chain (Sprint 4)

From BACKLOG 🟠. Chain is currently mocked (`USE_MOCK_CHAIN=true`); DB stays authoritative.

- ⬜ Fund a TestNet treasury, run `reset_asa`, wire `ASA_ID`.
- ⬜ Move NFT metadata to IPFS (ARC-3).
- ⬜ DB↔chain reconciliation job + `onchain_txid` audit trail.
- ⬜ On-chain Cannabis Cup trophy NFT; diploma NFTs (university).
- *Invariant:* never let on-chain state drive gameplay truth — the chain mirrors the DB.

---

## Milestone 3 — Depth & the moat (later)

From BACKLOG 🟡 and the Design Codex (`docs/memory/design/`). Sequence after the loop is
provably stable and the chain is real.

- ⬜ **Sim Phase B** — photosynthesis + transpiration + EC/pH→uptake (land the sim cost cap
  first). Wire PPFD/DLI→yield (KB enrichment §6).
- ⬜ **Generative genetics** — polygenic genome + mutation/epistasis/G×E toward endless,
  *discovered* strains; genome fingerprint → on-chain GenBank + Proof-of-Cultivation.
- ⬜ **Grower-skill mastery** — use-based skill trees, distinct from the spend-based research
  tree.
- 🔨 **Trust layer** — generalize provable-fairness replay from breeding to sim/weather/
  discovery; public faucet-vs-sink economy view; advisor confidence surfacing; no-dark-patterns
  charter.
- ⬜ **Education-gated Master Grower** (owner idea) — tie advisor depth + breeding consumables to
  University progress (composes existing systems; needs a design doc + balance pass).
- ⬜ **Sponsored / branded content** (owner idea) — sponsored GenBank cultivars + branded
  equipment via the on-chain asset layer; needs a partner/content model + trust guardrail.

---

## Cross-cutting rules (don't drift)
- DB authoritative; sim pure & server-authoritative; money is `Decimal` + ledger-posted
  (every faucet has a sink). Writes are API-key-authed + rate-limited; reads public.
- Providers (chain, AI) stay swappable behind ABCs — CI runs on mocks, never a live key.
- Balance changes go in `data/balance.yaml`, not code, where possible.
- Add a test with every feature; keep `make test`, `make lint`, `make check-memory` green.
