# GROWv2 — 90-Day Roadmap

A cannabis-growing game with a persistent economy, real genetics/crossbreeding, a real-time grow
simulation, and an Algorand on-chain asset layer. Phases 1–3 (DB + economy, simulation, on-chain
ASA/NFT) are built and tested, and **Sprints 1–3** (hardening, gameplay depth, and the full web
client) have shipped. This roadmap takes it from "working backend" to "production game."

**Legend:** ✅ done · 🔨 in progress · ⬜ planned. Each sprint is ~2 weeks with explicit exit
criteria. "Roles" are functional hats, not headcount.

---

## Foundation (shipped) ✅
- ✅ Persistent DB (SQLAlchemy + Alembic; SQLite dev, Postgres prod)
- ✅ Ledger-based economy (Decimal money, auditable, anti-inflation sinks)
- ✅ Strain genetics + deterministic crossbreeding
- ✅ Real-time grow simulation (overwatering/pests/disease/health, compute-on-read)
- ✅ Algorand provider abstraction: ASA token + ARC-3 NFT minting (TestNet, mock for tests)
- ✅ Retention: daily stipend + achievements; player XP/leveling

---

## Sprint 1 — Harden the core (Days 1–14) ✅
**Goal:** the backend is safe to expose publicly.
- ✅ Per-player **API-key auth** on write endpoints (reads stay public)
- ✅ Uniform **error envelope** + global 400/404/405/500 handlers + input validation
- ✅ **Health/readiness** probes, structured logging w/ request IDs, request timing
- ✅ **CI** (GitHub Actions): lint + pytest + `alembic upgrade head` on every PR
- ✅ **Docker** + docker-compose (api + Postgres); gunicorn in prod
- ✅ **OpenAPI 3** spec at `/openapi.json` + Swagger UI at `/docs`
- **Exit:** CI green on PRs; image boots against Postgres; `/docs` lists every route; auth enforced. ✅

## Sprint 2 — Gameplay depth (Days 15–28) ✅
**Goal:** the game is fun to play through an API/CLI.
- ✅ Strain **search/filter** + favorites
- ✅ **Leaderboards** (richest, top breeders, biggest harvest, highest level)
- ✅ **Market auctions** (bids, expiry, highest-bidder settlement)
- ✅ **Weather events** feeding the sim (heatwave, humidity spike, cold snap)
- ✅ **Pod automation** (tiers grant auto-water/feed)
- ✅ **Strain stabilization** (selfing/backcross → unlock NFT mint)
- ✅ **NPC contracts/orders** (deliver N grams by deadline for GROW + XP)
- **Exit:** a full play-loop (grow → care → harvest → sell/breed/stabilize → mint → trade) via API. ✅

> Beyond the original plan, also shipped: post-harvest **curing** + **terpene genetics**, a
> **research tree** + **consumables shop** + seasonal-strain gating, and an **AI "Master Grower"**
> (read-only advisor → guarded agentic auto-care). See `BUILDLOG.md` and `docs/memory/`.

## Sprint 3 — Web frontend, client v1 (Days 29–42) ✅
**Goal:** players can *see* their grow react in real time.
- ✅ React/Next app (Next.js 15 App Router + TS + Tailwind + React Query) in `web/`; API-key auth
- ✅ Pod & plant dashboards rendering live `condition_flags` (drooping leaves, bugs, mildew, height,
  health bars) from `GET /plants/<id>/state`
- ✅ Market, breeding lab, strain catalog, leaderboards, contracts, account UIs
- ✅ Real-time updates via polling (React Query `refetchInterval`; the lazy sim advances on read)
- ✅ Read-only `GET /players/<id>/pods` and `/plants` endpoints + web CI (lint/typecheck/build)
- **Exit:** a player completes the full loop in-browser; plant visuals change with sim state. ✅

> Beyond the original client v1, the **full web UI** shipped (2026-06-08, branch
> `claude/growv2-web-ui-build-MZWZE`): all seven screen groups — onboarding · grow dashboard with
> live VPD/DLI/PPFD readouts · strain lab + encyclopedia + DNA/lineage constellations + Verify
> provenance · GenBank galaxy · market (fixed/auctions/contracts) · Cannabis Cup + Hall of Fame ·
> University catalog/transcript + AI Professor lecture reader · Profile with lifetime titles. The
> signature dependency-free `<Constellation>` Canvas engine renders DNA/breeding/GenBank. See
> `docs/memory/standups/2026-06-08-lut-report-web-ui-build.md`. *(Next: Playwright e2e.)*

> Also shipped beyond the original Sprint 1–3 plan (see `docs/memory/BACKLOG.md`):
> - **Sim depth — Phase A**: derived **VPD + DLI** with the stored light scalar wired into the tick
>   (`simulation/horticulture.py`), exposed on `/state`.
> - **Strain knowledge base**: a scientist-grade encyclopedia for every catalog strain (catalog grown
>   16→22) at `GET /strains/<id>/knowledge`.
> - **Provably-fair provenance/lineage**: verifiable breeding replay (`/strains/<id>/provenance`) and
>   the whole pedigree / GenBank family tree (`/strains/<id>/lineage`).
> - **Seasonal Cannabis Cup**: per-season competition with deterministic scoring + lifetime champion
>   rewards (`/cup/*`).
> - **GrowPod University**: enroll → study → degrees (permanent perks) taught by an AI Professor
>   (`/university/*`).

## New-Player / Launch-Readiness track (post-Sprint-3, ACTIVE) 🔨
**Goal:** turn the working game into a *launchable* MVP — onboarding, mobile, retention — on existing
rails (off-chain MVP first). Shipped since the web client v1:
- ✅ **FTUE epic — guided first grow** (2026-06-14, PRs #34/#35/#39): a free starter pod + seed on
  signup (one-shot/idempotent), a deterministic guided tutorial (plant → water → climate → grow →
  harvest → "come back tomorrow") coached by a scripted AI Master Grower, and the web `/ftue` route.
- ✅ **Launch Strain Integration Pack** (2026-06-13, PR #33): White Rhino, White Fire OG, Gelato,
  Wedding Cake — catalog now **29 strains** with a 1:1 scientist-grade encyclopedia (sync test green).
- ✅ **Mobile-first navigation** (2026-06-14, PR #36): native bottom tab bar, safe-area handling,
  focus-visible rings, ≥44px thumb-zone CTAs, responsive Grow Chamber.
- ✅ **OMNI Charter v1.0** (2026-06-14, PR #38): organizational constitution (`docs/OMNI_CHARTER.md`).
- 🔨 **Critical path to MVP:** Feature Flags (open PR #42) → Mobile Polish → Playtesting → Retention
  Validation → MVP Launch Candidate. See `docs/memory/CANONICAL_STATE.md` + `docs/HANDOFF.md`.

## Sprint 4 — Real TestNet + IPFS (Days 43–56) ⬜
**Goal:** assets are really on-chain.
- ⬜ Fund a TestNet treasury; run `reset_asa`; wire `ASA_ID`
- ⬜ Move NFT metadata to **IPFS** (Pinata/web3.storage); image pipeline for cards
  - 🟩 *Foundation landed (PR #29, 2026-06-14):* a headless, deterministic chamber renderer
    (`web/src/lib/chamber/chamberCore.ts` + `npm run gen:stages` via `@napi-rs/canvas`) renders
    plants to PNG off-browser — the basis for a per-strain/per-stage card-image pipeline.
- ⬜ DB ↔ chain **reconciliation** job; `onchain_txid` audit
- ⬜ Non-custodial **Pera/WalletConnect** path (transfer NFT to player's own opted-in account)
- **Exit:** mint a real TestNet NFT end-to-end; balances reconcile; metadata resolves on IPFS.

## Sprint 5 — Multiplayer & social (Days 57–70) ⬜
**Goal:** players interact safely.
- ⬜ Player-to-player **trading**, friends, co-op grow rooms, basic chat
- ⬜ **Server-authoritative** review of sim/economy (no client-trusted state) + anti-cheat
- ⬜ **Rate limiting** + abuse controls; idempotency keys on mutations
- **Exit:** two accounts trade and co-grow; load test shows no economy exploits.

## Sprint 6 — LiveOps & tournaments (Days 71–84) ⬜
**Goal:** repeatable engagement.
- ⬜ Seasonal/limited strains; timed events; breeding **competitions**
- ⬜ Seasonal leaderboards; **analytics/telemetry**; data-driven balance passes
- ⬜ Admin/LiveOps console for content + balance (hot-reload `balance.yaml`)
- **Exit:** run a 1-week event end-to-end with rewards and a season reset.

## Launch readiness (Days 85–90) ⬜
- ⬜ **Load & soak testing**; performance budget for `/state` catch-up at scale
- ⬜ **Security review** (authz, secrets, injection, rate limits) + dependency audit
- ⬜ **Age-gating/compliance** review (cannabis-themed, simulated only) + ToS/privacy
- ⬜ **MainNet migration** plan (treasury custody, asset reissue, cost model)
- ⬜ Staged **public beta**.

---

## Cross-cutting tracks (continuous)
- **Testing:** keep suite green; raise coverage; property tests for ledger/genetics; sim determinism.
- **Docs:** keep `docs/PHASE*.md`, `docs/ROADMAP.md`, OpenAPI, and `BUILDLOG.md` current.
- **Observability:** logs → metrics → traces as traffic grows.
- **Economy stewardship:** monitor faucets/sinks; tune `balance.yaml`; watch for inflation.

## Risks & watch-items
- **Sim cost at scale:** compute-on-read catch-up is O(elapsed hours); cap + consider background
  batching/materialization for dormant plants.
- **Custodial key custody:** encrypt at rest, secrets-manager only, before any real value.
- **Regulatory framing:** simulation/entertainment only; no real cannabis sale; clear age-gating.
- **On-chain cost/latency:** keep gameplay DB-authoritative; chain is settlement/mirror.
