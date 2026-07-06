# 🧭 GrowVerse Architecture Truth — verified current-state snapshot

> **Layer 1 companion doc.** `ARCHITECTURE.md` holds the stable invariants; this doc is the
> **verified inventory** of what exists today, produced from three parallel read-only audits on
> **2026-07-06** (architecture, game systems, agents/integrations) and cross-checked against the
> repo. It is the baseline the [GrowVerse Roadmap](GROWVERSE_ROADMAP.md) builds on and the
> [Execution Machine](EXECUTION_MACHINE.md) executes against.
>
> Capability tags: ✅ built · 🔨 partial · ⬜ planned. Refresh this doc whenever a phase changes a
> load-bearing fact (same PR, so memory never lies).

---

## TL;DR — GrowVerse is not greenfield

GROWv2 is a **working, tested game** with far more built than a fresh plan would assume. The
GrowVerse roadmap is an **upgrade path over existing systems**, not a rebuild. The single most
important planning fact: the plant-state engine, the ~3,100-LOC chamber renderer, the full
grow→harvest→breed→mint loop, the ledgered economy, 5 live AI agents (+1 code-ready), and 1,140
passing backend tests **already exist**.

---

## 1. Backend (`src/growpodempire/`)

| Area | State | Notes |
|---|---|---|
| `simulation/` | ✅ Solid, protected pattern | Pure engine, compute-on-read lazy catch-up. No player-scoped economy logic inside (charter invariant). Plant state at `simulation/state/plant_state.py`. |
| `services/` | ✅ Solid | Ledgered `Decimal` economy, settlement (explicit ASA creation only — hardened in audit PR #148), contract-expiry persistence, withdrawal caps fail-closed. |
| `api/` | ✅ Solid | 50+ endpoints. Writes need `X-API-Key` auth; reads public; mutations rate-limited. |
| `chain/` | ✅ Solid, gated | Provider ABCs; deterministic Mock for CI; genesis-ID guard on the Algorand provider; **never require live keys in CI**. |
| `ai/` | ✅ Stronger than expected | **5 Claude-backed agents live + 1 code-ready, behind provider ABCs** (see §5). Structured output via `messages.parse()`; deterministic mocks in CI. |
| `data/balance.yaml` | ✅ PROTECTED | The tuning surface. Economy changes are data-driven here and owner-gated. |
| `genetics/` | ✅ Solid | Deterministic Mendelian crossbreeding, stability/rarity progression. |
| DB | ✅ Solid | SQLAlchemy + Alembic; SQLite dev / Postgres prod; alembic-drift CI gate (added PR #148); 1,140 tests, ≥93% coverage (floor 79%, ratcheted). |

### Plant state engine — `simulation/state/plant_state.py` ✅
Persistent aggregates: `overall_health` (death at ≤1), `water_level`, `nutrient_level`,
`pest_level`, `disease_level`, `stage` (seed → germination → seedling → vegetative → flowering →
late_flower → harvest), `height_cm`, `age_hours`, `genome` (trait genes + dominance), `generation`.
Transient per-part subsystems (`roots`, `stem`, `leaves[]`, `flowers`, `morphology`) plus computed
`condition_flags[]` (overwatered, root_rot, underwatered, nutrient_burn, pest_infestation,
mildew…). Moods (idle/boosted/stressed/rare/mutation) are **derived UI cosmetics**, not persisted
engine state — this is the gap the roadmap's Pod Visual work closes.

### Economy — `data/balance.yaml` ✅ (audited)
GROW (symbol GC, 6 decimals — deliberately ASA-scale). Ledger-first with optimistic-lock wallet +
non-negative CHECK constraint. Full faucet/sink table lives in `balance.yaml`.
⚠️ **Launch gate:** seeds currently cost 0 (test mode) — restore to 25 GROW before public launch
(owner-gated `balance.yaml` change).

---

## 2. Web (`growpod/web/`, Next.js 15)

- **Routes (30+):** `/dashboard`, `/dashboard/plants/[plantId]/{chamber,bud,command}`,
  `/lab/{breed,genbank,microscope,strains/[id]}`, `/market`, `/store`, `/mission`,
  `/university/{courses/[key],coach,learner,explorer,transcript}`, `/factions`, `/cup`,
  `/leaderboards`, `/profile`, `/onboarding`, `/ftue`, `/admin/economy`,
  `/dev/{blockchain,morphology,plant-review}`, `/demo`, `/guide`, `/contracts`, `/account`.
- **Chamber (core surface):** climate sliders (temp/RH/CO₂/light/pH/fan) with optimal bands,
  time-scrubber growth preview, care dock (water/feed/prune/train/inspect/boost), plant mood pill,
  harvest + pod-cleanup flow, consolidated ArcadeToolbar (gear/items/bundles/partners — PRs
  #153–156).
- **Pod visual system** — `web/src/lib/chamber/chamberCore.ts` (~4,300 LOC) ✅ mostly complete:
  per-stage morphology, genetics-driven silhouettes (indica bushy / sativa spire), health→leaf
  color, pest/disease stippling, care-action reaction overlays, trichome frost by maturity,
  environment tints. 🔨 **Missing:** animated mood states, mutation/rarity visual indicators.
  ❄️ 3D bud viewer is **owner-frozen** — the 2D chamber is canonical.
- **Algorand client** — `web/src/lib/chain/algorand/client.ts` ✅: algosdk singletons;
  `NEXT_PUBLIC_ALGO_ENABLE` (default off) + `NEXT_PUBLIC_ALGO_SIMULATE` (default on — only the
  literal `"false"` arms real txns); genesis guard; explorer links; `encodeNote(prefix, obj)`
  already implements ARC-69-style event notes (`gpe` prefix); dev faucet; `/dev/blockchain` test
  console at `web/src/app/dev/blockchain/page.tsx` (NODE_ENV-gated, PR #155).
- **UI system:** `Button` (36/42px min-heights post-PR #156), `Modal`, `Tabs`, `Pills`, `Card`,
  `Toast`, `Field`, `CollapsiblePanel`, `StickyActionBar`. 🔨 Known debt (4-agent UI audit): raw
  `text-gray-*` vs `ink-*` tokens, ~47 components with inline button styles, three divergent
  expand/collapse patterns, form-validation and focus-ring gaps.

---

## 3. Full loop — VERIFIED end-to-end ✅

Verified by the web e2e care-loop spec: buy seed → plant → care (water free / feed 5 / treat 15–20
/ prune / train / boost 6h-cooldown / growth-boost 60 GROW) → harvest → cure (1–336h commit) →
sell (quality × rarity × THC × terpene pricing) → breed (75+ GROW, deterministic cross, F1
instability, stabilization +0.15/gen, mint gate at stability ≥0.85 + rarity ≥ rare) → mint (ARC-3
metadata + SHA-256 hash, DB-first idempotent flow, **mock provider**).

Care cadence: 24h wall clock ≈ one calendar day; simulation `time_scale` ≈ 0.0085×; turbo 250×
(≈6-min watchable harvest). Daily login faucet.

---

## 4. Content ✅

- **29 strains** (`data/strains.yaml`) + 1:1 knowledge-base entries in
  `data/strain_knowledge.yaml` (test-enforced).
- **University:** 6 departments, 14+ courses, degree perks. 🔨 Only `bio-101` has an assessment
  bank — **14 to author**.
- **Cannabis Cup** (deterministic scoring), **contracts** (NPC deliveries), **achievements**,
  **14-node research tree**, **marketplace** (auction + listing, 3% list fee + 5% sale tax).

---

## 5. AI agents — 5 live + 1 code-ready + 2 scaffold

| Agent | State | Location/usage | Verdict for roadmap |
|---|---|---|---|
| Advisor (plant diagnostician) | ✅ Live | `ai/`, plant detail | Backbone of the new Scout |
| Master Grower (conversational) | 🔨 Code-ready | `/api/game/ask` endpoint live; web UI already exists at `/university/coach` (`BotChatPanel.tsx`) — not surfaced elsewhere | Extend surface area (dashboard/chamber), not build from zero |
| Lecturer (course content) | ✅ Live | university | Keep; feeds knowledge layer |
| Admissions (intake quiz) | ✅ Live | FTUE | Keep + surface recommendation |
| Roadmap (learning paths) | ✅ Live | university | Keep |
| Auto-Care (autonomous care) | ✅ Live, budget-gated | `services/` | Only autonomous mutator — gate behind runtime guard |
| Video Presenter (HeyGen) | 🔨 Mock only | university | Archive until post-MVP |
| FTUE Coach | 🔨 Placeholder | onboarding | Rebuild into onboarding |

Provider pattern: every agent swaps deterministic Mock (offline, no key) ↔ real Claude by config.
CI always runs mocks.

---

## 6. Algorand config matrix

| Dimension | Values | Current |
|---|---|---|
| Provider | Mock (CI/dev default) · Real (testnet/mainnet) | Mock — real produces fake asset IDs today |
| `NEXT_PUBLIC_ALGO_ENABLE` | off (default) / on | off |
| `NEXT_PUBLIC_ALGO_SIMULATE` | on (default) / off | on (only `"false"` arms real txns) |
| Network | testnet (default) / mainnet | testnet label; genesis-ID guard enforced |
| Treasury | `ALGO_TREASURY_MNEMONIC` (Fly secrets), `ASA_ID` | mnemonic pattern ready, `ASA_ID` unset ⇒ mock |

Guard rails (all ✅, from audit PR #148): genesis-ID validation, fail-closed ASA creation off-mock,
network-label contract. **Mainnet is a do-not-build-yet item** pending a dedicated security pass +
owner approval.

---

## 7. Test / CI / deploy state ✅

- Backend: 1,122 tests, 93.64% coverage (floor 79%, ratcheted). Property/invariant tests guard
  ledger + genetics.
- Web: `typecheck · lint · build · vitest · playwright`; a route-crash sweep across 29 routes is a
  permanent regression net.
- Gates: `make test`, `make lint`, `make check-memory` (via `scripts/check_memory.py`), alembic
  single-head + drift check.
- Deploy: auto-deploy to Fly.io on merge to `main`; secrets in Fly secrets manager, never in CI.
- Pushes only to `claude/*`; destructive git denied.

---

## 8. Ranked gap list (becomes roadmap work)

1. **Feature flags dormant** — 5 of 12 flags gate nothing when OFF; web never reads
   `GET /api/game/flags` (defaults to env). High-value early fix. → Roadmap p18 prep.
2. **No player-facing mission/quest system** — `/mission` is a self-documented, nav-hidden,
   owner/admin-only "Mission Control v0" ops board (`web/src/app/mission/page.tsx`); there is no
   `MissionService` and no player quest system anywhere in the backend. This is new-build work, not
   a wiring job. → p10 (correctly scoped as new-build in the roadmap; do not describe it as
   "wiring an existing service").
3. **Master Grower chat** — endpoint live; a web UI already exists at `/university/coach`
   (`BotChatPanel.tsx`) but isn't surfaced on the dashboard/chamber. → p05/p10.
4. **Chain settlement not live** — mock only; testnet go-live needs treasury funding, `ASA_ID`,
   deposit txid verification, and a reconciliation job (BACKLOG "RISK #7"). Only **replay
   protection** belongs to p07 (Phase 7's own "Do NOT touch" list forbids withdraw/deposit/
   settlement work); treasury/`ASA_ID`/deposit-verification is p13, and the **reconciliation job is
   p22** (see GROVERSE_ROADMAP.md Phase 22). → p07 (replay protection only) / p13 / p22.
5. **Idempotency-Key header** — infrastructure shipped (commit `7333b86`, 18 mutation endpoints via
   `@require_idempotency`); confirm full mutation coverage. → p07/p13.
6. **Assessment banks** — 14 course YAMLs to author. → p06.
7. **Mood animations + mutation/rarity visuals** — state exists, visuals TBD. → p03.
8. **Market P2P settlement** — flows exist; web settlement incomplete. → p08/p13.
9. **UI consistency debt** — token migration, panel unification, form validation. → p14.
10. **~108 merged `claude/*` branches** pending cleanup (owner tap: auto-delete on merge).

---

## 9. Protected surfaces (never touch without the gate)

`chain/`, settlement/withdrawal/deposit math, `data/balance.yaml` economy numbers, Alembic
migrations, auth, wallet UI, lockfiles. Any diff here follows the protected-surface PR gate in
`docs/BUILD_RULES.md` and the roadmap's security model: Security-Reviewer checklist + owner testnet
click-test + transaction-watcher capture in the PR body. **Never rewrite funds-path math; never
enable mainnet** without a dedicated security phase + owner approval.

---

*Baseline frozen 2026-07-06. When a phase changes a fact here, update it in the same PR.*
