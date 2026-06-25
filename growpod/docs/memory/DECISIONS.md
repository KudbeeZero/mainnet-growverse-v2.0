# Decision Log (Layer 2)

Append-only, lightweight ADRs. Newest at the bottom. To change a past decision, add a new entry
that **supersedes** the old one (don't delete history).

Format: `### YYYY-MM-DD — Title` · **Decision** · **Why** · **Consequences**.

---

### 2026-06-07 — DB-authoritative, chain-as-mirror
**Decision:** Gameplay truth lives in the relational DB; Algorand (ASA token + ARC-3 NFT) is a
settlement/mirror layer behind a provider ABC.
**Why:** On-chain latency/cost/availability can't gate the core loop; tests and CI must run with no
network. **Consequences:** A mock chain provider exists and is the default in tests; real wiring
(funded TestNet, IPFS metadata, reconciliation) is deferred to its own sprint.

### 2026-06-07 — Pure, compute-on-read simulation engine
**Decision:** `simulation/` derives plant state lazily from elapsed time + stored inputs and stays
free of player-scoped logic. **Why:** Determinism (testable, reproducible) and cheap writes.
**Consequences:** Research/consumable perks are applied in `services/` around the engine, never
inside it. Accepted risk: read cost is O(elapsed hours) — flagged for batching at scale.

### 2026-06-07 — Decimal, ledger-based economy with sinks
**Decision:** All currency is `Decimal`; every economic effect posts to an auditable ledger; faucets
are paired with sinks. **Why:** Avoid float rounding bugs and runaway inflation in a persistent
economy. **Consequences:** Property tests assert ledger invariants and pricing monotonicity.

### 2026-06-07 — Swappable providers for chain & AI (mock + real, config-selected)
**Decision:** `chain/` and `ai/` each expose an ABC, a deterministic Mock, a real impl, and a
factory. Config (env) selects the impl; CI uses mocks. **Why:** Keep CI key-free and offline;
make prod a config flip. **Consequences:** New external integrations should follow this same shape.

### 2026-06-07 — AI "Master Grower": read-only advisor first, then guarded agentic auto-care
**Decision:** Ship the advisor as read-only (`AdvisorService`) before letting it act
(`AutoCareService`), and gate actions behind a per-invocation `SpendGuard` (GROW budget + action
cap) that posts through the normal ledger care path. **Why:** Server stays authoritative; an agent
literally cannot overspend. **Consequences:** `ENABLE_AUTO_CARE` flag + budget live in
`balance.yaml:auto_care`; mock loop covers CI.

### 2026-06-07 — Removed the legacy v1 subsystem
**Decision:** Deleted in-memory `app.py`/`models/`/`blockchain/`/CLI/demo + `ENABLE_LEGACY_API`,
and dropped now-unused numpy/pandas. **Why:** Two parallel implementations is debt; OpenAPI at
`/openapi.json` + `/docs` is the single API source of truth. **Consequences:** Stale `API.md` /
`IMPLEMENTATION.md` removed; README rewritten for the real GROWv2.

### 2026-06-08 — Adopt a Markdown memory-layer system
**Decision:** Introduce `CLAUDE.md` (Layer 0) + `docs/memory/` (Layers 1–4) as the project's
persistent memory, with a daily LUT standup ritual. **Why:** Work was moving fast across many
sessions with no durable, structured context; higher layers were drifting from reality (roadmap,
build log). **Consequences:** Invariant changes must update Layer 0/1 in the same change; one
standup per working day under `standups/`.

### 2026-06-08 — Adopt a Design Codex sub-layer (vision/intent beside Layer 1)
**Decision:** Add `docs/memory/design/` as a low-volatility, vision-forward sub-layer next to
ARCHITECTURE: a global game-vision doc that leads with the **proprietary moat** (a real
plant-physiology sim → generative genetics → Proof-of-Cultivation → on-chain GenBank → discovery
economy → earned mastery → AI data flywheel), plus deep docs for the scientist-grade simulation,
generative genetics, and grower-skill mastery. Every capability is tagged `✅/🔨/⬜`.
**Why:** Work was moving fast with no durable home for *deep design intent* — what makes the game
different and how the sim/genetics get there — separate from ARCHITECTURE's "what must not break."
The user wants the depth (horticulture realism, endless genetics, time-as-investment) to be the
differentiator and to be captured before it's built. **Consequences:** The codex *proposes* shape;
work still becomes real via BACKLOG. Moat claims lean on planned (⬜) systems — especially anything
on-chain (the chain is mocked; GenBank/Proof-of-Cultivation are ⬜) — and must stay tagged so the
docs never oversell. When a 🔨/⬜ ships, flip its tag and update ARCHITECTURE/CLAUDE in the same
change if an invariant moved.

### 2026-06-08 — Phase A horticulture: derive VPD/DLI, read light in the tick
**Decision:** Add `simulation/horticulture.py` (pure Tetens SVP + leaf-VPD + DLI derivations); the
engine now reads the stored pod light scalar and the derived VPD as gentle, generously-banded health
terms (tuned in `balance.yaml` under `simulation.light` / `simulation.vpd`); VPD/DLI/PPFD are exposed
on `/state`. **Why:** "Derive first" is the cheapest scientist-grade realism — it honors the
compute-on-read / O(elapsed-hours) cost risk, so heavier physiology (photosynthesis, transpiration,
EC) waits for Phase B behind the sim-cost-cap. It also turns moat #1 ("a real plant-physiology
engine, not a timer") into running code. **Consequences:** Bands are neutral at the optimal
environment, so the suite stayed green; new tuning knobs live in `balance.yaml`; the engine is now a
small physiology model. The other 11 genes + spectrum/photoperiod remain 🔨/⬜ (see
`docs/memory/design/01-simulation-horticulture.md`).

### 2026-06-08 — Provably-fair breeding: replay-and-verify
**Decision:** Expose `GET /strains/<id>/provenance` (`services/game_service.py:verify_strain`) that
re-runs the deterministic `cross()` from the persisted `BreedingEvent.rng_seed` + the immutable
parent genomes and confirms the stored genome matches. The breed endpoint already refuses a
client-supplied seed (anti seed-shopping). **Why:** the seed was already persisted for determinism;
exposing a public replay turns an internal invariant into a *player-facing* trust property — nobody
can fabricate or tamper a cultivar's genetics without detection. **Consequences:** establishes the
"replay & verify" pattern (generalizable to sim/weather/discovery draws), and promotes a new
invariant — randomness stays seeded so gameplay is auditable (ARCHITECTURE invariant #9). The trust
layer now has a shipped affordance (🔨 — breeding done; see `docs/memory/design/04-honesty-and-trust.md`).

### 2026-06-08 — Coverage gate completes "make truth automatic"
**Decision:** Add a `pytest --cov` gate with a ratchet floor (`pyproject.toml` `[tool.coverage]
fail_under=78`, operational `scripts/` omitted), wired into `make test` and the CI test step.
**Why:** the ruff lint gate guards syntax and `scripts/check_memory.py` guards the docs; coverage
guards the test safety net itself from silently eroding — the third leg of the 2026-06-08 standup's
§4A "make truth automatic." **Consequences:** CI fails below the floor; **raise the floor as
coverage climbs, never lower it.** One-shot ops scripts are excluded (run by ops, not the unit suite).

### 2026-06-08 — Strain knowledge base as a separate data layer
**Decision:** Keep `data/strains.yaml` as the canonical game **genome** and add a separate
`data/strain_knowledge.yaml` — a scientist-grade **encyclopedia** keyed by slug (lineage, origin,
sensory/effect profile, cannabinoid & terpene detail, cultivation parameters) — surfaced read-only at
`GET /strains/<id>/knowledge` (`services/game_service.py:strain_knowledge`). Grow the catalog 16→22.
**Why:** reference/horticulture metadata is the differentiator ("every piece of data a scientist
would want") but must not entangle the genome/balance that drives gameplay; separating them keeps the
sim/economy clean and lets the KB grow independently. **Consequences:** a test enforces 1:1
catalog↔KB sync (every strain has an entry, no orphans); the KB ships from source like the other data
files (no `package_data`). The encyclopedia figures are reference ranges, not per-plant sim outputs;
a `/deep-research` campaign will verify/deepen them.

### 2026-06-08 — Seasonal Cannabis Cup with lifetime champion rewards
**Decision:** Add a seasonal competition (`services/cup_service.py`, `db/models.py:CannabisCup`/
`CupEntry`): one Cup per season (`edition = "<year>-<season>"`, keyed off `events.current_season`),
players enter unsold harvests for a fee, entries are ranked by a deterministic server-side
`cup_score` (`economy/pricing.py`), and the champion earns **lifetime** prestige — a one-of-a-kind
LEGENDARY trophy strain (minted from the winning genetics, with the winning strain as its parent),
a permanent `Player.cannabis_cup_title`, and a permanent Hall-of-Fame record. Lifecycle is lazy
(opens on access, auto-judges when the season window closes), idempotent, ledger-guarded.
**Why:** the grow/genetics depth needed a recurring, social endgame that turns quality into prestige
("rare realities that are lifetime"); seasons make it a renewing LiveOps loop and advance the
discovery-economy/mastery moat (#5/#6). **Consequences:** two new `LedgerEntryType`s (`CUP_ENTRY_FEE`
sink, `CUP_PRIZE_PAYOUT` faucet); a forward-only Alembic migration (`d5e6f7a8b9c0`) — **note:** the
true migration head was `c7e2f4a16b80` (a fork existed at `fbb8fceedacd`), caught by testing
`alembic upgrade head` (single-head check belongs in CI). On-chain trophy NFT + judged
terpene-cluster categories are ⬜ (Sprint 4 / `05-events-and-competition.md`).

### 2026-06-08 — GrowPod University: earned degrees with time + practical gating
**Decision:** Add a learning subsystem (`services/university_service.py`, `data/curriculum.yaml`,
`db/models.py:CourseEnrollment`/`DegreeProgress`): enroll (pay **tuition**, a sink) → study real time
→ complete by meeting a **practical tied to live gameplay** → earn **degrees** that grant permanent
perks + a `Player.university_title` + XP. An AI **Professor** (`LecturerProvider` mirroring the
advisor stack: deterministic mock for CI, Claude in prod) delivers lectures. Curriculum grounded in
real programs (`docs/research/2026-06-08-cannabis-education-curriculum.md`). **Why:** the moat's
earned-mastery axis (#6) needed a *do-to-learn* counterpart to the GROW-spend research tree, and the
game's depth deserved a teachable home; time + practical gating rewards serious players. **Consequences:**
degree perks reuse the research `_EFFECT_KEYS` and are summed into the `_research()` effect helpers
(no parallel apply path); new `LedgerEntryType.TUITION` (sink, no GROW faucet → net-deflationary);
forward-only migration `e7a9c1b3f2d8` (single head verified). Quizzes, more departments, a Doctorate
tier, and diploma NFTs are ⬜ (`06-university.md`).

### 2026-06-08 — Strain names are lore, not genetic ground truth (research-backed)
**Decision:** Per a 5-agent deep-research campaign (`docs/research/2026-06-08-cannabis-strain-genetics-and-cultivation.md`),
treat strain **names** and the `indica_ratio`/genotype label as *loose phenotype/morphology lore*, not
reliable predictors of genetics, chemistry, or effect; keep the genome + verifiable lineage as the
authoritative identity. Annotate disputed clone-era lineages (OG Kush, Chemdawg, Sour Diesel, Bubba
Kush, GG4; Maui Wowie as landrace-derived) as such in the KB, and add the THC-inflation / chemotype
caveats to the KB header. **Why:** the peer-reviewed evidence is strong and convergent — Sawler 2015
(names/ancestry unreliable; r²=0.36), Schwabe 2019 (90% of strains had a genetic outlier), McPartland
& Guy 2017 (vernacular indica/sativa is botanically inverted), Reimann-Philipp 2020 (hundreds of names
→ ~3 terpene chemovars), Schwabe 2023 (THC labels inflated ~15–35%). Honesty is a product pillar
(`04-honesty-and-trust.md`), so the KB must not present marketing as fact. **Consequences:** future
enrichment adds a `terpene_cluster` per strain and models assayed THC as an inflation-biased
distribution; the research also confirms light (PPFD/DLI→yield, ~linear to ~1500–1800) as the
best-evidenced Phase B sim lever, and validates today's VPD/DLI bands as defensible (vendor-tier).

### 2026-06-10 — Bounded compute-on-read via dormancy-snap (not a lower cap, not grind-forward)
**Decision:** A single `engine.catch_up` simulates at most `simulation.max_catchup_hours`
(balance.yaml, 8760 = 1 year); an absence beyond that puts the plant in **dormancy** for the
remainder — `last_tick_at` and `stage_entered_at` shift past the gap so the plant lands exactly at
`now` with its stage clock paused, and an auditable `dormancy` PlantEvent records `skipped_hours`.
**Why:** the pre-existing clamp left `last_tick_at` behind `now`, so a derelict plant repaid the
full cap window on *every* read (measured 310 ms/read, repeated once per year of absence) — the
clamp bounded a single loop but not convergence. Lowering the knob instead would change gameplay
outcomes for legitimate long grows (worst-case stretched lifecycle ≈ 4,500 h); grinding forward
kept unbounded total cost. One year comfortably exceeds any real lifecycle, so no live plant loses
true progress, and unattended plants die early in the window anyway (loop breaks on death).
**Consequences:** worst case is one 311 ms read **once ever** per derelict plant (then 0.1 ms);
near-term reads (< cap) are bit-identical to before (parity asserted in tests); `dormancy` joins
the event vocabulary (consumers treat `event_type` as opaque — verified); the residual at-scale
risk (many first-reads in one burst) stays on ARCHITECTURE's watch list with background
materialization as the eventual answer. Tests: `tests/test_simulation.py` (bounded step count,
one-read convergence, stage-clock pause, normal-read parity, death path).

### 2026-06-10 — Concurrency safety via DB-enforced invariants + optimistic locking
**Decision:** Close the highest-value concurrency exploits (carried RISK #6) at the **database
level**, not just in application checks: (1) wire `Wallet.version` as SQLAlchemy `version_id_col`
so two concurrent debits can't both commit — the loser gets `StaleDataError`, rolls back, and the
API maps it to a clean **409**; (2) a `CHECK(cached_balance >= 0)` backstop so a wallet can never
persist negative even on an app bug; (3) a unique index on `harvests.plant_id` so a plant is
harvested exactly once (a raced double-harvest can't mint duplicate currency). Migration
`f1a2b3c4d5e6` (single head; `compare_metadata` clean). **Why:** the prior guards were
check-then-act with no row lock, and `Wallet.version` was dead code — on prod `gunicorn -w 2`,
two requests double-spend / double-harvest. Declarative DB constraints hold under *any*
concurrency model and are portable SQLite↔Postgres, so correctness no longer depends on Python
evaluation order. Chose to remove the manual `wallet.version += 1` in `ledger.post()` (SQLAlchemy
now owns the column). **Consequences:** concurrent conflicting writes fail safe (409 + rollback,
client retries) instead of corrupting; +4 concurrency tests (`tests/test_concurrency.py`) prove
double-spend, harvest-once, and the CHECK floor; the F5 flaky rate-limit test is fixed (limiter
storage reset per `client` fixture). **Still open (next baton):** a general `Idempotency-Key`
header so a duplicate returns the *original* response instead of a 409 (nicer UX), plus
one-shot-grant uniqueness (daily stipend, achievements). 189 tests, 79.26%.

### 2026-06-11 — Launch liquidity = bring-your-own ALGO; fiat payment rails deferred
**Decision:** At launch, players fund participation by acquiring ALGO themselves (exchange or
wallet of their choice — the non-custodial Pera/WalletConnect path already on the backlog). No
fiat payment rail (Stripe or otherwise) is in scope now. **Why (owner call):** plenty of
liquidity routes exist without us building one; a fiat rail is a whole new pillar — PCI/compliance
surface, merchant-of-record and refund policy, and a real-money **faucet** that needs a matching
sink and treasury policy — and per the charter every real-money decision is owner-gated anyway.
It also makes no sense before chain settlement itself is real (RISK #7 still blocks any real
value moving). **Consequences:** zero payments code in the repo; a 🟡 BACKLOG item records the
option with its preconditions so the thinking isn't lost; if revisited, the integration shape is
Stripe Checkout Sessions (+ Billing if subscriptions), behind RISK #7 being closed and an
explicit owner green-light.

### 2026-06-13 — Whole-plant buds de-graped with a continuous bud-mass silhouette
**Decision:** In the chamber whole-plant view, each `FlowerSite` now paints a single **continuous
bud-mass** behind its calyxes — every developed cluster contributes an overlapping blob fused into
one fill, each sized to reach ~70% of the way to its neighbour so the gaps close — and the calyx
pods / pistils / trichomes render on top as texture (`drawFlowerSite` in `GrowChamber.tsx`). **Why:**
at chamber distance the discrete teardrop calyxes are too small to overlap, so a flower site read
as a handful of loose circles ("grapes"); the macro view already beats this with a solid cola core
under layered calyxes, and the chamber site had no such core. The mass width follows the existing
per-cluster width curve, so silhouettes stay strain-recognisable (G13 spiral → slim spear cola;
PDP / Animal Mints nodal → chunky stacked masses), and the top cola + node/tip sites flow through
the same path so they gain mass and merge near the apex. **Consequences:** silhouette-only, no new
systems — one linear gradient + one fill per site per frame, placement precomputed once and shared
with the texture pass for lock-step sway; pure logic (`morphology`/`budDna`/`strainVisuals`)
untouched, so all 100 vitest tests (incl. Constellation sacred hashes) stay green. The pixels are
owner-device-verifiable (no headless browser in CI to screenshot the chamber).

### 2026-06-14 — Chamber renderer extracted into a shared, headless-capable core (PR #29)
**Decision:** The grow-chamber Canvas 2D renderer (build + draw + physics) was moved **verbatim**
out of `GrowChamber.tsx`'s React `useEffect` closure into a framework-agnostic factory
`web/src/lib/chamber/chamberCore.ts` (`createChamberCore(opts)`); the component is now thin DOM glue
(canvas/ctx, DPR transform, ResizeObserver, RAF loop, IntersectionObserver gating, pointer mapping)
that delegates to the core. A Node script `web/scripts/gen-stage-pngs.ts` (`npm run gen:stages`)
drives the same core through `@napi-rs/canvas` to render the curated strains × growth-stage matrix
to PNG, fully off-browser. **Why:** the brief ("Canonical Stage PNG Generation") needed deterministic
per-strain/per-stage plant images renderable without a desktop/browser, but the draw code was trapped
in the component closure. Extracting it to a single source means the live component and the headless
generator render through **identical code** — no drift — and the generated PNGs double as proof the
extraction preserved the live render. Chosen over Playwright screenshots (heavy Chromium dep, needs a
running server, may not install under the network policy) and over a parallel reimplementation (would
drift). `@napi-rs/canvas` (prebuilt Skia, zero system libs) was chosen over `node-canvas` (needs
Cairo/Pango/jpeg at build time; Pango/jpeg absent here). **Consequences:** the live render is
unchanged (byte-for-byte relocation; all web gates green, 112 vitest); PR #29 was carried on PR #26's
branch (single-branch dev rule) and merged together with it, so #25's de-grape `drawFlowerSite` change
was ported into `chamberCore` on merge to avoid regressing it. Output dir `web/canonical-stages/` is
gitignored (regenerable artifact; the generator is the committed deliverable). Future card/NFT image
pipelines (ROADMAP Sprint 4) can build on this headless renderer.

### 2026-06-14 — MVP feature-flag layer (gate non-MVP systems off)
**Decision:** Five non-MVP systems — marketplace, on-chain wallet/minting (`chain`), the Cup,
the University, and NPC contracts — are gated behind boolean flags that default **OFF**. Backend
flags live in `config.Settings` (env `ENABLE_*`), are copied into `app.config["FEATURE_*"]` at
`create_app`, and are enforced per-route by a `require_feature` decorator (`api/feature_gates.py`)
applied above `require_player` so a gated route returns **404** before auth — a hidden system is
indistinguishable from an absent one. The web client mirrors them via `NEXT_PUBLIC_ENABLE_*`
(`web/src/lib/features.ts`): the nav filters gated entries, a `RequireFeature` guard wraps the
`/market`, `/cup`, `/university` route segments, and in-page bits (Market→Contracts tab, Profile
wallet section) hide too. **Why:** the MVP launch ships only the core grow loop; fail-closed
defaults mean a system can never leak by forgetting to set an env var. **Consequences:** the test
harness enables all five flags (`tests/conftest.py`) so the subsystem suites keep exercising real
behavior, with a dedicated `tests/test_feature_gates.py` proving OFF→404 / ON→reachable, gate-
before-auth, and core-loop-unaffected. The services and routes are untouched (hidden, not removed),
so flipping a flag on at deploy time restores the full system. First slice of PR #31 (MVP Launch
Candidate).

### 2026-06-14 — Flat `/state` wire is canonical; no `GameState` wire object (PR #30)
**Decision:** The dashboard/PDP/encyclopedia keep reading the **flat** `GET …/plants/<id>/state`
payload (`PlantState` = `Plant` + server-computed `metrics` + `forecast` + `recent_events`) as the
single source of truth. We do **not** build the aggregate `GameState · EnvironmentState · UIState`
wire objects that `knowledge/whole-plant-architecture.md` sketches. Server stays authoritative for
forecast/metrics; web's `STAGE_DAYS`/`climateModel` remain **preview/visual-only** and must defer to
`plant.forecast`/`plant.metrics`. Bud phenotype stays a pure client derivation
(`morphologyFor`/`silhouetteFor`/`budColorForStrain`/`budDnaFor`/`applyEnvironmentToBudDNA`) seeded by
strain — never persisted, never wired. **Why:** the flat wire already carries everything the UI needs;
the audit (PR #30 planning) found the "5-layer state" doc to be aspirational, and a real unification
would be a large refactor with no MVP payoff. **Consequences:** PR #30 is consumption polish + bug
fixes, not a state rewrite. A global 401/403 handler (`AuthErrorListener`) now tears down the session
on a rejected key (RISK #9); `usePods` refreshes on an interval + focus so the chamber bud phenotype
reflects committed pod environment. The knowledge doc's `GameState/EnvironmentState/UIState` section
is documentation aspiration, not a build target, until a future PR proves a need.

### 2026-06-14 — Launch time-compression: a single `time_scale` pacing knob
**Decision (Director-approved, Player-Obsession Lab):** Compress the whole grow lifecycle for launch
via one new balance knob, `simulation.time_scale` (default 1.0 = canonical real-time; launch value
**0.075**), multiplied into **every** stage duration in `engine._stage_duration_hours` — the
pre-flower `stages.*_days` knobs *and* the genetic `flowering_time` window alike. A 60-day-flower
strain now runs ~7.8 real days seed→harvest (flowering ~day 3.3, trichome frost reads ~day 5), so a
new $25-pod player experiences the full emotional arc — growth → branching → pre-flower → buds →
frost → phenotype colour → harvest — inside week one instead of ~7 weeks out. Paired with a renderer
fix: the live chamber now derives its developmental day from the **authoritative** server stage +
`forecast.stage_progress_pct` (`morphology.nominalGrowDay` → `previewDev`) instead of wall-clock
`ageDays`, and the "to harvest" readout reads `forecast.hours_to_harvest`. Without this the compressed
plant would flip to *flowering* while the renderer (whose bud/frost ramps key off absolute nominal
days, buds from ~day 34) still drew a flowerless plant — i.e. the magic would not surface.
**Why:** the obsession research scored the MVP 6/10, capped by *week-1 silence* — every
screenshot-worthy moment the renderer can already produce was gated ~44+ days out, past the 72-hour
window in which retention is decided. This is pure tuning + visual-surfacing-timing: no new systems,
no genetics change, no economy *rate* change. It also reinforces the PR #30 ADR (web stage timing
defers to `plant.forecast`, never wall-clock).
**Consequences:** (1) `time_scale` is the launch dial — set back toward 1.0 to lengthen the cycle
without code changes; canonical real-time `stages.*_days` stay documented for that reversal. (2) The
harvest faucet is **gated by grow time**, so compressing the cycle accelerates that faucet's *cadence*
(no rate/price changed, but harvests arrive ~13× sooner) — a deliberate, owner-approved launch trade;
watch realized GROW inflation and treat the canonical pace as the post-launch target. (3) This stands
in tension with the moat pillar "grows take real days; time is the gate / anti-whale"
(`design/00-game-vision.md` §6, `03-grower-skills.md`): it is a **launch-pacing** decision, not a
repudiation of the pillar — the knob exists precisely so the long-game pace can return. (4) All gates
green: backend `make test` 224 passed / 80.84%, `make lint`, `make check-memory`; web `tsc`,
`next lint`, `next build`, `vitest` 119. The pixels (buds/frost surfacing in week one) remain
owner-device-verifiable — no headless browser screenshots the live chamber in CI.
**Reconciled onto `main` (PR #66, 2026-06-14):** the paired fan-leaf renderer change (the original
session's Priority #1) was **dropped as superseded by the Engines 1–4 renderer** already on `main`;
only the `time_scale` pacing knob, the stage-progress dev wiring (`nominalGrowDay`→`previewDev`), and
the `forecast.hours_to_harvest` readout landed. Gates re-run on the merge — see the PR #66 evidence.

### 2026-06-14 — Phyllotaxy & pseudo-3-D depth for the whole-plant chamber (Engines 3 & 4)
**Decision:** The chamber whole-plant skeleton no longer places every node hard-left/hard-right in one
flat picture plane. A new pure module `web/src/lib/chamber/phyllotaxy.ts` assigns each node an
**azimuth** around the stem — decussate (~180° alternation) at the base, easing into the **137.5°
golden-angle spiral** toward the apex as the plant matures — and `chamberCore` projects that azimuth
into pseudo-3-D: signed horizontal foreshortening (`lateral = cos·az`), front/back **depth**
(`sin·az`) that drives back→front draw order, an atmospheric lightness shade, and a per-node **leaf
yaw** that turns fans edge-on when their branch winds toward the camera (Engine 4) plus a small
per-node roll. A per-plant `phase` (seeded) rotates the whole pattern so no two plants of a strain
align. **Why:** the PBSA charter's two most explicit "do not" items were "billboard all leaves toward
the camera" and "leaves must never all face the camera"; the flat alternation read as a decorative
diagram, not a living organism. This is the highest-leverage believability + "no two plants identical"
win, and is renderer-only (no economy/chain/db/api). **Why this shape:** the azimuth is built by
*cumulative* angular steps lerping 180°→137.5°, so at the seedling/veg end (steps≈180°) it reproduces
the **legacy flat alternation exactly** — the signed-off veg/seedling silhouettes are preserved — and
only blooms into spiral depth with maturity; strain silhouette knobs (spread/shorten/density/cola)
are untouched, so G13 stays a slim spear and PDP/White Rhino stay chunky. **Consequences:** the
`Node` carries `depth/litAdj/leafYaw/leafRoll`; `drawFan` gained optional `litAdj`/`yaw`; `drawPlant`
sorts nodes by depth before painting. `phyllotaxy.ts` is unit-tested (the maturity-0 case asserts
byte-equivalence to the old left/right alternation). Verified against the headless `gen:stages` PNGs
across all seven curated strains × stage matrix. Pointer/physics indexing is unchanged (draw order is
cosmetic; `phys.nodes[i]` still keyed by real node index). Next builds on this: branch azimuth can
later feed true light-seeking pitch and circadian leaf motion (PR #28, parked).

### 2026-06-14 — Apical dominance / multi-cola architecture (Engines 1 & 2)
**Decision:** The whole-plant chamber no longer always grows exactly one top cola. A new pure module
`web/src/lib/chamber/apicalDominance.ts` (`colaTops`) turns a strain's new `Silhouette.apicalDominance`
(0..1) into how many tops compete with the leader (1 → 4) and how the flower mass splits between them
(`leaderShare` + `secondaryShares`, conserved to 1). `chamberCore.buildPlant` promotes the highest
`count−1` nodes — **only in flower** — into upright **co-colas**: it straightens their tilt toward
vertical and extends their length so they race the leader to the canopy, builds each a scaled-down
sibling of the leader cola sized by its mass share, and suppresses their node-buds/branchlets so they
read as clean colas; the central leader cola is scaled by `leaderShare` (floored at 0.62× so it stays
*the* main cola). **Why:** the PBSA charter (Engines 1 & 2) and `knowledge/whole-plant-architecture.md`
call apical dominance "the highest-impact" identity knob — a single cola + side branches (spear, G13)
vs. several competing tops (bush, Purple Diddy Punch / White Rhino) is what makes strains read as
*different plants*, not recolours of one model. **Why this shape:** `apicalDominance = 1` ⇒ `count = 1`,
`leaderShare = 1` ⇒ byte-identical to the old single-cola path, so high-dominance spear strains and all
veg/seedling plants are unchanged (co-colas exist only in flowering); mass is conserved so a multi-top
plant doesn't gain total bud. Authored per curated strain (G13 0.85, White Fire OG 0.72, Animal
Mints 0.6, Gelato 0.55, Wedding Cake 0.5, PDP 0.42, White Rhino 0.4) and derived `lerp(0.72,0.58,r)`
for others. **Consequences:** `Silhouette` gained a required `apicalDominance` field (all 7 authored
silhouettes + the derived fallback updated; `colaTops` unit-tested incl. mass-conservation + the
single-cola degenerate case). Verified across the 7-strain × stage PNG matrix. Built on the same
PBSA branch as Engines 3 & 4 (carried in PR #58).

### 2026-06-14 — Simulation test clock is an offset on the existing compute-on-read seam (BE-002, STEP 3)
**Decision:** The dev/test-only "simulation test clock" is built as an **`OffsetClock`** layered on the
engine's existing `Clock` seam — not a new code path through the engine. The engine is already
compute-on-read driven by `clock.now()`; the new clock is a wall-clock shifted by a mutable,
**forward-only** offset, so advancing it makes the *next* read of any plant catch up through the
normal `engine.catch_up`. A process-wide singleton (`get_test_clock`/`reset_test_clock`) holds the
offset; `active_clock()` returns it **only** when `settings.test_clock_enabled`, else a plain
`SystemClock`. `SimulationService`'s default clock now resolves through `active_clock()` (explicit
injection still wins), so every read endpoint picks up the shift with no per-call-site changes.
A dev-only blueprint `api/dev_api.py` (`/api/dev/clock`, `/clock/advance`, `/clock/reset`) is
**registered only when enabled** and re-guards per request. **Why:** STEP 4 (e2e grow-loop testing)
and launch-readiness need to drive a full grow → harvest in seconds; the cleanest, lowest-risk way is
to move the clock, because the engine already treats `now` as the only input. Reusing the seam means
zero new simulation logic and no drift from production behaviour. **Safe boundaries (constraints
honoured):** the flag is **force-disabled in production** — `test_clock_enabled = GROW_TEST_CLOCK=true
AND APP_ENV ∉ {production,prod}` (new `APP_ENV` setting) — so a live deployment can never register the
routes or hand the engine a fast-forwardable clock. Advancing time triggers **only** compute-on-read
catch-up, which posts **no ledger entries** and changes no prices/faucets/sinks (covered by
`test_advance_does_not_touch_the_economy`). The clock is **forward-only** (a backward jump would
desync `last_tick_at`); a single advance is capped at one catch-up window (`MAX_ADVANCE_HOURS=8760`).
**Consequences:** `reset` rewinds the *clock*, not the plants — time already simulated is persisted
(compute-on-read really advanced them), so a full reset means reseeding the dev DB; documented in
`docs/SIMULATION_TEST_CLOCK.md`. No production behaviour changes when disabled (`active_clock()` →
`SystemClock`, identical to before). New tests in `tests/test_test_clock.py` (15) cover the primitive,
the config gating, the selector, and the endpoints; full suite 246 green, coverage 81.9% ≥ 79%.

### 2026-06-14 — e2e grow loop is test-only; the cure-clock fix is deferred (BE-004, STEP 4)
**Decision:** STEP 4 validates the core loop **seed → plant → grow → flower → harvest → sell**
end-to-end through the public HTTP API, fast-forwarded with the STEP 3 dev clock, as **test-only
additions** (`tests/test_e2e_grow_loop.py`, `tests/test_http_boundary.py`) with **no source
changes** — honouring the directive's "test-only / no production behaviour changes" rule. The
HTTP-boundary coverage for the value-bearing routes (withdraw/deposit/mint/nft) was added here,
partially closing RISK #8 on the backend side. **Finding surfaced:** `GameService` (harvest/cure/sell
and market/auction expiry) defaults to `SystemClock`, **not** `active_clock()`
(`services/game_service.py:82`), so the dev clock does **not** fast-forward cure or auction timing at
the HTTP boundary — the directive's loop (no cure) didn't need it, so cure was excluded from the e2e.
**Why deferred:** closing it is a one-line change mirroring STEP 3 (`self.clock = clock or
active_clock()`), production-behaviour identical (`active_clock()` → `SystemClock` whenever the clock
is disabled, i.e. always in prod), but it edits a production-path file — so under a "test-only"
directive the owner explicitly chose (2026-06-14) to **defer it to the next chat** rather than slip it
in here. **Consequence:** STEP 4 ships on the **same branch as PR #47** (the STEP 3 clock is not yet
in `main`, so a STEP 4 PR based on `main` is impossible without first merging #47); PR #47 therefore
carries clock **+** its first real consumer. NEXT ACTION (owner-approved): STEP 4.5 — the
`active_clock()` one-liner + cure/auction e2e. Suite 262 green, coverage 83.6% ≥ 79%.

### 2026-06-14 — FTUE is orchestration on existing rails; tutorial time is a per-plant fiction (FTUE epic: PR #34/#35/#39)
**Decision:** The first-time-user experience is built as **pure orchestration over existing game
actions** — no new economy, no Phase-2 systems. A guarded deterministic step machine on
`Player.ftue_step` (`welcome → plant → water → environment → grow → harvest → completed`) drives the
**real** services (`grant_starter_items`, `plant_seed`, `water`, `set_environment`,
`harvest_plant`+sell); each `advance` is rejected if out-of-sync or already completed (no replay).
The AI Master Grower's tutorial voice is **deterministic and scripted** (`ai/ftue_coach.py`, per-step
static `AdvisorReport`s through the real advisor schema) rather than a live AI call, so it works in CI
with no key and reads identically every time. **Why two sub-choices matter:** (1) *Time-compression* —
a real first grow is days long; the `grow` step backdates the tutorial plant's `planted_at` (so the
chamber renders a mature flowering plant) and sets `last_tick_at = now` so the authoritative catch-up
does **not** retro-decay it. Chosen over (a) running the full hour-by-hour sim across the gap — which
would drought-kill the un-watered plant and spam event rows — and (b) giving the starter pod
auto-water/feed, which is a paid-tier **economy** change. The fiction is scoped to the single tutorial
plant; global sim/time and the `max_catchup_hours` knob are untouched (general dormancy RISK #9
unchanged). (2) *No auto-divert of existing players* — the migration backfills `ftue_step='welcome'`
(`server_default`), so the web only routes **freshly created** accounts into `/ftue`; returning
sign-ins and pre-existing players are never swept into the tutorial. **Consequences:** the epic is
additive (3 nullable-safe `Player` columns + a new service/coach/route + endpoints; one-shot starter
grant via a `grant_claims` unique index); the core loop and ledger are untouched; the "come back
tomorrow" hook points at the existing daily stipend rather than minting a new reward. Migrations
`c7ecd7523cc8` (grant rail) and `9d669edf48a8` (FTUE columns) keep a single Alembic head.

### 2026-06-14 — Mobile-first navigation: native bottom tab bar over a hamburger drawer (PR #36)
**Decision:** On small screens the web client uses a **native-app bottom tab bar** (primary
destinations + a "More" sheet for secondaries) rather than a hamburger/drawer; the desktop header
takes over at the `lg` breakpoint. Touch targets are ≥44px, with `env(safe-area-inset-*)` padding for
notches/home bars and focus-visible rings for keyboard a11y. **Why:** thumb-reach + muscle memory on
phones, and the grow chamber is the emotional core — it should feel like a native app, not a desktop
site shrunk down. **Consequences:** shipped in `web/src/components/layout/` (tab bar + responsive
shell); the chamber became responsive; remaining player surfaces (dashboard / PDP / `/ftue`) still
need a small-screen sweep (open PRs #40 bottom-nav follow-through, #41 care feedback). Visual-only;
no API/economy change.

### 2026-06-14 — Adopt the OMNI Charter v1.0 as the organizational constitution (PR #38)
**Decision:** Add `docs/OMNI_CHARTER.md` as the **governance** layer (who decides, who builds, what
each team may touch, how work crosses boundaries) sitting beside — not replacing — the technical
memory system (`CLAUDE.md` + `docs/memory/`, which governs the *code*). Codifies the chain of command
(Owner → Director Chat → Department Leads → Specialist Agents → Monitoring), department roster, the
work-order system for cross-department changes, and canonical principles (off-chain MVP first; polish
over features; no Phase-2 leakage into Phase-1; CI/audits before merges; emotional attachment as a
first-class metric). **Why:** work is fanning out across many specialized AI sessions; clear authority
and boundaries prevent scope creep and duplicate work. **Consequences:** the charter's "no autonomous
merges / no repository mutations without approval" rule aligns with the existing delegation charter in
`CLAUDE.md`; the Records-Department reconciliation function (this sweep, REC-004) and
`docs/memory/CANONICAL_STATE.md` are governance artifacts under the Operations department.

### 2026-06-14 — GameService reads the active clock too (BE-004.5 / STEP 4.5)
**Decision:** `GameService` now defaults its clock to `active_clock()` (was `SystemClock()`),
mirroring the STEP 3 change in `SimulationService`. **Why:** STEP 4 surfaced RISK #1 — harvest/**cure**/
sell and market/auction expiry all live in `GameService`, which used wall time, so the dev/test clock
(`/api/dev/clock/advance`) could fast-forward *growth* but not *cure or auction* timing over HTTP. A
committed cure could never be exercised end-to-end without waiting real days. **Consequences:**
production behaviour is byte-identical — `active_clock()` returns `SystemClock` whenever the test clock
is disabled (always in prod; default in tests where no clock is injected), so the full suite is
unaffected. The dev-clock path now drives cure + auction expiry. New e2e
`test_e2e_grow_loop.py::test_cure_advances_under_dev_clock` proves a cure can't finish before the dev
clock passes its window and that finishing then raises quality. Test-only otherwise; one-line source
change. Suite 273 green, coverage 84.46% ≥ 79%. RISK #1 cleared.

### 2026-06-14 — Feature flags are data-driven (balance.yaml), config-authoritative for exposure
**Decision:** Player-facing surfaces are gated by a feature-flag layer whose definitions/defaults
live in `balance.yaml` (`feature_flags:`), resolved by `feature_flags.py` with per-environment
`FEATURE_<NAME>` env overrides, served read-only at `GET /api/game/flags`, and guarded server-side
via `require_feature`/`feature_required`. Flags fail closed (unknown → off); no per-player table.
**Why:** Mirrors the existing "tuning surface" convention (data over code) so launch surfaces (FTUE,
chamber, marketplace, …) can be kill-switched without a deploy. DB stays authoritative for gameplay;
flags govern *exposure* only. Per-player/cohort targeting is deferred until a real need (would be an
additive table, not a rewrite). **Consequences:** Backend core ships first (this PR); web route/nav
gating is a separate surface-claimed PR. Defaults are ON, so adding a flag changes no behaviour until
a surface is explicitly gated.

### 2026-06-14 — Collapse to ONE feature-flag system (balance.yaml canonical) — supersedes the #42 config path
**Decision:** Two feature-flag systems landed on `main` ~1 minute apart, out of the agreed order:
**#42** (env `ENABLE_*` in `config.Settings` → `app.config["FEATURE_*"]`, `api/feature_gates.py`
decorator gating ~25 routes, defaults **OFF**) and **#55** (the balance.yaml resolver above, defaults
**ON**, `GET /api/game/flags`). They contradicted each other (routes gated OFF by #42 while `/flags`
reported ON from #55). Per the BE-003 decision, **#55/balance.yaml is canonical**; the #42 path is
**removed**. The route decorators now use `feature_required` from `growpodempire.feature_flags`
(→ `FeatureDisabledError` → 404 via the blueprint handler); `api/feature_gates.py`, the `config.py`
`ENABLE_*` block, and the `app.config["FEATURE_*"]` mirror are deleted; `balance.yaml feature_flags:`
gained `chain` + `contracts` and the `cup` decorators were renamed to `cup_competitions` so every
gated surface maps to exactly one canonical flag. **Why:** the `balance.yaml` data-over-code invariant,
and one source of truth (no divergence). **Consequences:** gated routes now follow balance.yaml
defaults (**ON**) — the launch build turns non-MVP surfaces (marketplace/chain/cup_competitions/
university/contracts) OFF via `FEATURE_*` env, *not* a code default. A regression test asserts each
route's gate state equals its `/flags` value so the two can never diverge again. Web route/nav gating
(still on `NEXT_PUBLIC_ENABLE_*`) is re-pointed to `GET /api/game/flags` in the separate Web Gating PR.

### 2026-06-14 — CEO ratifies PR #63 as the single feature-flag system; #61 closed (FF-RECON-001 EXECUTED)
**Decision:** With two chats having driven **opposite** flag reconciliations in parallel — **PR #63**
(keep `balance.yaml`/`feature_flags.py`, delete #42's `feature_gates.py`/config `FEATURE_*`) and
**PR #61** (the reverse) — the CEO **ratified #63** as canonical and **closed #61 as superseded**.
No revert of #63; no rebuild of the #42 path; no recreating duplicate flag infrastructure.
**Why:** #63 already achieved the goal (one source of truth), is green, and aligns with the
`balance.yaml`-as-tuning-surface invariant; reverting would be pure rework against launch momentum.
**Consequences:** `balance.yaml`/`feature_flags.py` is the sole canonical flag system; feature-flag
infra is a single-writer protected surface (registry). The web build-time `NEXT_PUBLIC_ENABLE_*`
mirror remains as a deferred (non-defect) follow-up. The flag architecture is **not to be reopened**
absent a production defect; focus returns to Playtesting → Retention Validation → MVP Launch Candidate.

### 2026-06-14 — GrowPod University Phase 2 (UNI-001 v2) research APPROVED
**Decision:** The CEO accepted the Phase-2 "long-form academy" research
(`docs/research/UNI-001-v2-Master-Report.md` + Codex spec
`docs/memory/design/07-university-phase-2.md`, registered in `MAP.md`) and settled three open
decisions: (1) **`bio-101` "Foundations of Plant Biology"** is approved as the **no-prerequisite,
required introductory course** before `cult-101` (path `bio-101 → cult-101 → Intermediate → Advanced →
Capstone`) — plant science precedes cultivation systems; (2) the **named-faculty persona system** is
approved (roster Flora · Verdant · Mycelia · Atlas · Nova; Professor Flora teaches `bio-101`; names may
evolve, the system is locked); (3) the **ElevenLabs audio pipeline** is green-lit as its **own
greenfield implementation slice**, phases A–F (generation → storage → caching/versioning → voice
assignments → playback → accessibility/transcript-sync), with the locked rules generate-once /
cache-permanently / regenerate-only-on-change / versioned / transcript-parity / reusable.
**Why:** isolate the largest technical unknown (audio) from curriculum-implementation risk; lock
content ordering before any code. **Consequences:** research/architecture only — **no code, no
monetization, no tokenomics** introduced; the earned-mastery moat is unchanged (KXP/streaks/leagues
stay non-economic). Approved future build order: Framework → `bio-101` → Professor System → ElevenLabs →
Labs → Assessments → Certifications → Transcripts → Advanced Courses → Degree Programs. No
implementation is scheduled yet; these docs are the authoritative reference when it is.

### 2026-06-18 — `late_flower` promoted to a live, ADDITIVE engine stage
**Decision:** Split the lifecycle's final pre-harvest span by inserting a real `late_flower`
GrowthStage between `flowering` and `harvest`. It is **additive** — a fixed `late_flower_days`
(default 14, in `balance.yaml:simulation.stages`) appended *after* the genetic flowering window, not
carved out of it — so total seed→harvest time lengthens by `late_flower_days × time_scale`. The
previously inert `nutrient.stage_targets.late_flower: [500, 700]` band (added display-only by the
University Grow Console, PR #6) now resolves for real plants in that stage.
**Why:** Models the real ripening/flush phase growers care about and lights up the band the Grow
Console already shipped. Additive (vs. carve-out) was the **owner's explicit choice** — the
stop-and-ask sign-off CLAUDE.md requires for a player-facing pacing change.
**Consequences:** Harvest payoff (a faucet) arrives later by the late_flower duration; tune or
disable via `late_flower_days` (set 0 to revert to the old flowering→harvest flow). The chamber
renderer treats `late_flower` exactly like `flowering` (buds/frost keep progressing — no new art);
the engine's `_stage_duration_hours`/`_growth_cm_per_hour`, the forecast, the web stage maps, and
the `harvest_plant` gate (which never required a specific stage) all handle it. The economy's
faucet/sink *rates* are unchanged — only the cadence of the harvest faucet shifts.

### 2026-06-18 — Economy intentionally in free-playtest mode; guard tests gated, not deleted
**Decision:** Keep the current free-playtest economy (`balance.yaml` `seeds.base_cost: 0  # FREE for
testing — restore to 25 before launch`, `daily_stipend: 5000`) and make the six launch-economy guard
tests `skipif`-conditional on the live config value rather than restoring launch prices now or
deleting/weakening the tests. Tests: `test_economy.py::test_seed_price_scales_with_rarity`,
`test_game_service.py::{test_buy_seed_debits_and_adds_inventory,test_buy_seed_insufficient_funds,
test_marketplace_transfers_seeds_and_currency}`, `test_progression.py::test_daily_stipend_cooldown`,
`test_properties.py::test_seed_price_monotonic_in_rarity`.
**Why:** The red suite was these tests correctly reporting that the *real* economy is switched off for
playtesting. Restoring launch pricing is a player-facing economy change whose timing the balance.yaml
comment explicitly defers to "before launch" — an owner call, not a side effect of a late_flower PR.
Gating on the config keeps the suite honestly green now, preserves the invariants (rarity scaling,
price monotonicity, the 50-GROW stipend), and avoids touching gameplay.
**Consequences:** The six tests **skip** while `seeds.base_cost == 0` / `daily_stipend != 50` and
**auto-reactivate** to enforce the launch economy the moment those values are restored. **To go live
(owner, one balance.yaml edit):** `seeds.base_cost: 25`, `rarity_multiplier` `[common 1, uncommon 2,
rare 6, epic 20, legendary 40]`, `daily_stipend: 50`. No code change needed to flip it on.

### 2026-06-19 — Optional paid boost economy: planned, free-in-alpha, liquidity-first (docs only)
**Decision:** Document (not build) an **optional** paid plant-boost/recovery economy. During alpha all
boosts are **free and QA-labeled** (same convention as the `seeds.base_cost: 0 # FREE for testing`
flag). Full planning lives in `docs/product/` (boost economy, liquidity transparency, fairness
guardrails, UI copy, roadmap). **Why:** the creator needs sustainable revenue, but the core loop must
stay free and the transparency promise must hold — no pay-to-win, no secret routing of boost money
into Cup prize pools (the Cup is funded only by its own entry-fee sink). **Consequences:**
time-skip/speed/recovery/rewind boosts **do not exist yet** and are documented as `planned`, not
shipped; no payment rails are built; chain stays TestNet/mock-by-default. Five owner decisions gate
any real activation (allocation model A/B/C, money rails, recovery-vs-rewind, Cup policy, boost caps)
— see `docs/product/GROWVERSE_BUILD_PRIORITY_ROADMAP.md`. Any boost granting in-game value must post
through the audited ledger (`economy/ledger.py`).

### 2026-06-20 — Turbo speed faucet 10× → 250× ("watchable" pacing)
**Decision (owner-ratified):** Raise `simulation.turbo_multiplier` from `10.0` to `250.0`. At the
launch `time_scale: 0.0075` a plant is already ~21 hours of real play seed→harvest, so the old 10×
faucet still took ~2 hours and — because the engine grows in **1-hour steps** — visibly advanced only
once every ~6 minutes, reading as "the 10× doesn't work / it's frozen." 250× lands a full seed→harvest
in **~5 minutes**, and at the client's ~7s poll the bud visibly develops every poll.
**Why:** the whole point of turbo is to let a player *watch* a plant grow in one sitting; 10× never
delivered that. This is pure pacing on the per-account opt-in faucet — it changes only WHEN a harvest
lands, never its grams/quality/value, and touches no faucet/sink/price. The daily-stipend faucet stays
on the real wall clock. The clock math (`simulation/clock.py player_effective_now`) was already correct
and is unchanged; only the multiplier moved.
**Consequences:** (1) one-line balance knob — dial back toward 10× if 600× feels too fast. (2) Turbo's
mechanism tests (`tests/test_turbo_speed.py`) now inject a **pinned** config (M=10) so they verify the
banking/acceleration math independent of the production value — re-tuning never breaks them. (3) The ⚡
chip renders the live server multiplier, so it shows "600×" with no further UI change.

### 2026-06-21 — Launch pacing time_scale 0.0075 → 0.0085 (~21h → ~24h seed→harvest)
**Decision (owner-ratified):** Raise `simulation.time_scale` from `0.0075` to `0.0085`, so a full
seed→harvest for the canonical 60-day-flower strain runs ~24 hours (was ~21h). The base lifecycle is
118 days (seed 3 + germination 5 + seedling 10 + vegetative 26 + flowering 60 + late_flower 14 = 2832h);
`time_scale` scales every stage uniformly, so 2832h × 0.0085 ≈ 24.1h. Per-strain flowering differences
are preserved (a 30-day strain ≈ 18h, a 90-day strain ≈ 30h).
**Why:** the owner wants the whole loop — grow → care → breed → harvest → cure → sell — fast enough to
breed lots of strains and demo the full process in roughly a day, without building any new UI. This is
the same single global knob that previously compressed the cycle (1.0 → 0.075 → 0.0075); turning it
once more is the simplest possible change. Everything else is untouched: pods, care, breeding, harvest,
all views keep working exactly as-is; this is pure pacing and changes no genetics, prices, or
faucet/sink *rates*. (The turbo per-account faucet and its 250× value are unaffected; its comment was
refreshed so its "~24h → ~6 min" math stays truthful.)
**Consequences:** (1) one-line balance knob — easy to retune. (2) Watch-item: the `daily_stipend`
faucet runs on the real 24h wall clock, so at a ~24h grow it's ≈ one stipend per grow (clean); pushing
the cycle much faster than 24h would let harvests outpace the stipend, a faucet/sink balance concern to
revisit if pacing is shortened further. (3) Forecast tests derive expectations from the configured
`time_scale` (not a magic number), so they stayed green.

### 2026-06-25 — University Build Phase opened; faculty roster reconciled (Phase 0)
**Decision (owner-directed):** The owner authorized the **Immersive University Build Phase** (full v1:
graded courses, 3D Anatomy Explorer, professor video, Master Grower bot, engagement loop), built
isolated on `claude/university-*` branches behind the existing `RequireFeature("university")` flag so it
cannot reach players until the flag is flipped. This supersedes the UNI-011 "park until MVP" hold for
build purposes; MVP remains the protected priority and no university work touches MVP critical-path
surfaces (`balance.yaml`, feature-flag defaults, the pure `simulation/` engine, wallet/auth, lockfiles).
As **Phase 0**, the faculty roster was reconciled to the **shipped-code-authoritative** roster
(`ai/elevenlabs_narrator.py` `_DEPT_VOICES`): Professor Flora (cultivation) · Vera Lindqvist (genetics) ·
Dr. Sage Harlow (nutrients) · Dr. Mira Okafor (ipm) · Dr. Chem Torres (chemistry) · Dr. Petra Nance
(postharvest). The earlier Verdant/Mycelia/Atlas/Nova names are **retired**. `bio-101` "Foundations of
Plant Biology" is taught by **Professor Flora** in the **cultivation** department.
**Why:** Two faculty shared one voice — `nutrients` (Sage Harlow) reused Rachel, identical to
`cultivation` (Flora) — so the personas were not audibly distinguishable. The design pass also left a
stray `vera-lindqvist` manifest entry for `bio-101` that conflicted with the Flora scripts.
**Consequences:** (1) Dr. Sage Harlow now uses **Charlotte** (`XB0fDUnXU5powFXDhCwa`), distinct from
Flora — a one-line `_DEPT_VOICES` change; cached narration re-keys on the new voice and regenerates on
next prewarm (no data loss). (2) Design docs `07-university-phase-2.md` and `bio-101-lecture-scripts.md`
updated from "action item" to "resolved." (3) `make check-memory` green; 62 narration tests pass.
