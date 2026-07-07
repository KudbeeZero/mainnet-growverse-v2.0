# 🗺️ 90-Day Roadmap (2026 Q3) — owner priorities × GrowVerse phases

> **What this is.** The owner's 3-month execution plan (adopted 2026-07-07), built for **Sonnet**
> to execute one branch at a time via [EXECUTION_MACHINE.md](EXECUTION_MACHINE.md). It re-sequences
> the [22-phase GrowVerse roadmap](GROWVERSE_ROADMAP.md) around four owner directives:
>
> 1. **The seed-NFT claiming process must exist end-to-end** (today it is unreachable — see audit).
> 2. **The store must be correct** — every route real, every button working.
> 3. **Every store item must impact the plant** — a fan has a positive *or negative* effect
>    depending on the simulated conditions; the same for soils and CO₂.
> 4. **The main growing-pod area must visibly represent what's applied from the store.**
>
> Evidence for every work item: [AUDIT_NFT_STORE_LOOP.md](AUDIT_NFT_STORE_LOOP.md) (defect IDs
> N/S/E/C referenced throughout). Guardrails are unchanged from GROWVERSE_ROADMAP.md: DB
> authoritative / chain mirror; pure sim engine; `Decimal` ledger, faucets↔sinks; provider ABCs +
> keyless CI; `balance.yaml` owner-gated for *numbers*; testnet only; no funds-path rewrites.
> Branch names: `claude/gv-oNN-slug` (o = owner-priority track); gv-phase branches keep their
> `claude/gv-pNN` names. **One active branch/PR at a time**, always through
> handoff-audit → build → prove → verify → closeout.
>
> **Important consistency note (no P2W):** fans/soils/CO₂ effects are bought with **in-game GROW**
> — gameplay utility, same class as research nodes. The "no purchasable stat advantages" pillar
> constrains *real-money* purchases and is untouched by this plan.

---

## 0. The 30/60/90 shape

| Month | Theme | Milestone the owner can feel |
|---|---|---|
| 1 (w1–4) | **Make the store real** | Every button works; a fan measurably protects (or, misused, harms) the plant; the pod visibly shows equipped gear |
| 2 (w5–8) | **Own what you grow** | Cure→mint is coherent and un-strandable; wallets unified; a player claims their **seed NFT** on testnet with preview-before-sign |
| 3 (w9–12) | **Alive, guided, measured** | Telemetry on every beat; pod moods; Scout card recommends the fix you can buy; flags enforced; full-loop e2e green |

---

## 1. Week-by-week schedule

| Wk | Branch | Delivers | Fixes | Advances phase |
|---|---|---|---|---|
| 1 | `claude/gv-o01-store-correctness` | Store + harvest-panel button/route correctness | S1 S2 S6 S7 · C2 C3 C4 | p14 (debt down-payment) |
| 2–3 | `claude/gv-o02-equipment-sim-effects` | Fans/soils/CO₂ real simulation effects + generalized equip | S3 E1 E2 | p04 adjacent (pure helpers) |
| 4 | `claude/gv-o03-pod-equipment-visuals` | Chamber renders equipped gear + effects | S4 S5 | p03 groundwork |
| 5 | `claude/gv-o04-cure-mint-integrity` | Cure/mint state machine hardening | C1 C5 C6 C8 C9 | p07 prep, p13 prep |
| 6 | `claude/gv-o05-wallet-claim-unification` | One wallet stack; honest CTAs; naming split | N4 N5 N6 N7 N8 C7 C10 | p07a prep |
| 7 | `claude/gv-o06a-wallet-preview-watcher` | Preview-before-sign modal + txn watcher + `txn_log` | (enables N1/N2) | **p07a + p07b** |
| 8 | `claude/gv-o06b-seed-nft-claim` | **Seed-NFT claim end-to-end on testnet** + one asset registry | N1 N2 N3 N9 | **p07c** (extended to seeds) |
| 9 | `claude/gv-p02-game-loop-codex` | Loop codex + in-txn telemetry (incl. store/equip/claim events) | — | **p02** |
| 10 | `claude/gv-p03-pod-visual-moods` | Animated moods + mutation/rarity visuals | — | **p03** |
| 11 | `claude/gv-p05-scout-reports` (slice 1) | Scout pipeline + card UI (mock), equipment-aware advice | — | **p05** |
| 12 | `claude/gv-o07-flags-e2e-hardening` | Flags read from `/flags` + enforced; full-loop Playwright e2e | N10 C11 + BACKLOG #4/#5 | p18 prep, p17 slice |

Slack: each month has ~½ week of buffer inside its slices; if a slice slips, push the *phase*
branches (w9–11) right — never stack branches.

### 1b. Second-slot queue (extensive-capacity track)

The owner has cleared Sonnet for **extensive work** (2026-07-07): when a week's primary branch
merges with time to spare, take that week's second slot below — still **one active branch/PR at
a time** (sequential, never stacked), each through the full session loop. Second slots are
deliberately smaller and independent of their week's primary. If a primary slips, its second
slot moves right with it; second slots never displace a primary.

| Wk | Second-slot branch | Contents (BACKLOG refs) |
|---|---|---|
| 1 | `claude/gv-o01b-docs-chores` | Reconcile `docs/ROADMAP.md` (#6), retire `docs/NEXT_SESSION_SPRINT3.md` (#7), fix `BUILDLOG.md` header (#8), close stale draft PRs #151/#152 (HANDOFF risk), tick BACKLOG 0b (harvest gate — verified shipped in PR #164, `services/game_service.py:1136-1140`), add the HANDOFF staleness gate to `scripts/check_memory.py` (#29). Also: double-click purchase guard on sibling money buttons (BACKLOG 🔴 code-review finding) folds into **o01 primary** (button correctness). |
| 2 | `claude/gv-o02b-retire-dead-code` | Retire `serve_narration` (#17) + remaining dead web code (#21, owner-taste call on `VideoHero.tsx` goes to the owner first); DB-backup snapshot workflow (HANDOFF risk / SECURITY.md gap). |
| 4 | `claude/gv-o03b-wire-finished-backends` | BACKLOG #20: `GET /strains/<id>/effects` panel, `Player.last_active_at` touch — natural adjacency with o03's store/consumable UX work (the consumables use-item UI half already shipped in PR #137). |
| 5 | `claude/gv-o04b-idempotency-general` | General `Idempotency-Key` header semantics — duplicate returns the original response, not a 409 (#1/#25); one-shot-grant uniqueness audit. Ops (owner tap, not a branch): attach Fly Redis and drop `RATELIMIT_ALLOW_MEMORY` (INCIDENTS 🟡). |
| 6 | `claude/gv-p04-plant-state-ext` | **Phase 4 pulled forward** (GROWVERSE_ROADMAP spec, unchanged): care-history rollup, stress-event log, pure `project_metadata()` for ARC-19/ARC-69 — o06b's dynamic seed/harvest NFTs want this projection; landing it in week 6 keeps week 8 clean. |
| 6b | `claude/gv-o05b-lecture-audio-unify` | Unify `/lecture` on the produce-once audio path (#13) — small, isolated. |
| 9 | `claude/gv-o08-care-ack-welcome-back` | WO-1/WO-2 Grow Guide salvage (#22): per-action care-ack signals + welcome-back delta endpoint — pairs with p02 telemetry landing the same week. |
| 10 | `claude/gv-o09-chamber-mobile-followups` | Chamber mobile follow-ups (#12) riding p03's chamber work. Bud/flower polish (#11/#34) stays **owner-frozen** — needs the owner to name the gap first. |
| 11–12 | `claude/gv-p06-knowledge-layer` | **Phase 6 pulled forward** (GROWVERSE_ROADMAP spec): tagged KB + excerpt helper + the 14 assessment banks (#14) + admissions-recommendation persist/surface (#15) + MasteryPanel metadata (#16) + the four University playtest fixes (study-time dev-clock reach, course-completion celebration, bio-101 credentialing, University visibility in onboarding/mobile-nav). Grounds the week-11 Scout's lesson links. |
| 11 | `claude/gv-o10-onboarding-ai-guide` | Onboarding rework (#9, owner thread 2026-07-03: "too long, not exciting"): landing-page scroll + 3-panel FTUE coach wiring, making the existing Master Grower the visible guide — after p05 lands its Scout surfaces. |

---

## 2. Month 1 — Make the store real

### Week 1 · `claude/gv-o01-store-correctness`
**Purpose:** every store/harvest button does what it says, or is honestly disabled.
**Backend:** price featured `strain` items in `store_featured` (`api/game_api.py:2014-2022`) —
use the strain's seed price (respecting `seed_discount_pct` and seasonal rules) so the Buy button
renders (S1).
**Web:** invalidate `wallet`/`player` queries on featured-consumable buy + refetch featured
(S2, S7); fix the phantom `led_240w` test key (S6); gate HarvestsPanel buttons: Mint only when
rarity ≥ `mint_min_rarity` and not curing, with an explanatory tooltip otherwise (C2); cure
countdown using the existing `Countdown`/`useCountdown` primitives + disabled "Finish cure" until
ETA (C3); hide/disable "Sell" during curing (C4). Add component tests for the gating logic.
**Do NOT touch:** `balance.yaml` numbers, sim engine, chain, cure/mint *backend* semantics
(that's o04).
**Acceptance:** a pinned featured strain is buyable; GC balance updates everywhere after any
store buy; no button in store/harvests can produce a guaranteed-error toast; web gates green.
**Sonnet prompt:** *"Run /handoff-audit. Branch `claude/gv-o01-store-correctness` from fresh
main. Fix audit defects S1, S2, S6, S7, C2, C3, C4 exactly as specced in ROADMAP_90D_2026Q3.md
§2 week 1 (evidence in AUDIT_NFT_STORE_LOOP.md). Component tests for every new gate. Web gates +
make test/lint/check-memory green. /closeout: one draft PR `fix(store): featured-strain pricing,
balance refresh, honest harvest-panel gating`."*

### Weeks 2–3 · `claude/gv-o02-equipment-sim-effects` — **the flagship slice**
**Purpose:** every gear category has a real, tunable simulation effect; effects can be positive
**or negative depending on conditions** (owner directive).

**Design — data-driven `effects` blocks (new keys in `data/balance.yaml` `shop.gear`):**

```yaml
# Supported gear-effect keys (all optional, all consumed by the engine):
#   temp_offset_c, humidity_offset_pct      — shift the pod's EFFECTIVE env
#   pest_spawn_mult, disease_growth_mult    — scale hourly pest/disease pressure
#   water_decay_mult, nutrient_decay_mult   — scale hourly resource drain (soils)
#   flowering_quality_bonus                 — flat quality add at harvest, flowering-planted soils
fans:
  clip_fan:           {effects: {pest_spawn_mult: 0.85, disease_growth_mult: 0.90}}
  oscillating_fan:    {effects: {pest_spawn_mult: 0.70, disease_growth_mult: 0.80, humidity_offset_pct: -2}}
  inline_exhaust_6in: {effects: {pest_spawn_mult: 0.75, disease_growth_mult: 0.60, humidity_offset_pct: -8, temp_offset_c: -2}}
soils:
  worm_castings: {effects: {nutrient_decay_mult: 0.85}}
  bat_guano:     {effects: {nutrient_decay_mult: 0.90, flowering_quality_bonus: 2}}
  coco_coir:     {effects: {water_decay_mult: 0.85, nutrient_decay_mult: 1.15}}   # "needs feeding" — a real tradeoff
  super_soil:    {effects: {nutrient_decay_mult: 0.70}}
  perlite_mix:   {effects: {water_decay_mult: 1.10, disease_growth_mult: 0.90}}   # drains faster, healthier roots
```

**Why this satisfies "positive or negative based on simulation":** offsets apply to the
*effective* environment the engine already stress-scores. An exhaust fan in a humid tent pulls
humidity toward the optimal band → less mildew, better VPD → **positive**. The same fan in an
already-dry pod pushes humidity/VPD *out* of band → env stress rises → **negative**. Coco coir
buys water retention at the cost of faster nutrient drain. No new stat system — consequences
emerge from the existing math, which keeps it honest and tunable.

**Backend build:**
1. `simulation/gear.py` (new, **pure**): `effects_for(equipped: list[dict], catalog: dict) ->
   GearEffects` — merges equipped items' effect blocks (one item per category), clamps to sane
   bounds (offsets ±10, mults 0.5–1.5). Property-test determinism.
2. Engine consumption: `_env_for` applies `temp_offset_c`/`humidity_offset_pct` to the effective
   env; `_step` applies `pest_spawn_mult`/`disease_growth_mult` and the decay mults
   (`simulation/engine.py:177-192, 262-302`). Pass effects through `EngineContext`; `catch_up`
   reads the pod's equipped `GearInventory` rows (same established session-read pattern the
   catch-up path already uses). **Preserve `LegacyStepEngine` parity when no gear is equipped**
   (parity test exists: `tests/test_engine_parity.py`).
3. **CO₂ becomes real (E1):** add `co2` optimal band (e.g. `[400, 1400]` ppm) + a modest
   `co2_stress_weight`, and a small growth-rate bonus inside the band — the knob players already
   have finally matters. Keep weights conservative; tune in `balance.yaml`.
4. Generalize equip: `GameService.equip_gear(player_id, pod_id, gear_key)` — one equipped item
   per category per pod (reuses `GearInventory.equipped_pod_id`, **no migration**); lights keep
   writing PPFD (`game_service.py:615-654` pattern); add `unequip_gear`. New routes
   `POST /players/<pid>/pods/<pod>/equip-gear` + `/unequip-gear`; keep `/equip-light`
   backward-compatible. Idempotency-Key on both.
5. Expose equipped gear + net effects in the pod/plant state serializer so the web can render
   them (feeds o03).
**Web:** `GearPanel.tsx` drops the `["light"]` filter; equip/unequip for fans+soils with an
effect preview line ("−40% mildew growth · −8% humidity — careful in dry pods").
**Owner gate:** these are **new** `balance.yaml` keys (direction approved 2026-07-07, D7);
attach a short sim report to the PR (one plant, 4 scenarios: humid+fan, dry+fan, coco fed/unfed)
proving both signs of impact. No existing numbers change.
**Do NOT touch:** ledger, chain, cure/mint, existing balance numbers, genetics.
**Acceptance:** parity test green with no gear; fan reduces mildew in a humid pod and *hurts*
health in a dry one (both asserted in tests); soils shift decay measurably; CO₂ band scored;
determinism property tests green; coverage floor holds.
**Sonnet prompt:** *"Run /handoff-audit. Branch `claude/gv-o02-equipment-sim-effects` from fresh
main. Implement ROADMAP_90D_2026Q3.md §2 weeks 2–3 exactly: pure `simulation/gear.py`, engine
consumption of gear effects + real CO₂ band, `equip_gear`/`unequip_gear` service + routes (no
migration), serializer exposure, GearPanel equip UI with effect preview. New balance keys only —
change zero existing numbers. Tests: determinism property, both-signs fan scenarios, coco
tradeoff, no-gear parity. Attach the 4-scenario sim report to the PR. /closeout: one draft PR
`feat(sim): fans, soils and CO₂ get real simulation effects (equip any gear)`."*

### Week 4 · `claude/gv-o03-pod-equipment-visuals`
**Purpose:** the growing-pod area *shows* what the store applied (owner directive #4).
**Build:** replace the hardcoded `climate={{ fan: 45 … }}` with the equipped fan's real value
(`web/src/components/command/PodCommandCenter.tsx:288`); drive the grow-light glow intensity/hue
from equipped PPFD instead of the cosmetic constant (:321-323); add an equipped-gear chip row on
the chamber (light/fan/soil icon + name + net effect, from the o02 serializer); gentle canvas
leaf-sway when a fan is equipped (`prefers-reduced-motion` → static); soil rendered as the pot's
substrate tint; consumable apply keeps its existing reaction overlay. In-store "Apply to plant"
deep-link on owned consumables (S5).
**Verify:** capture-shots goldens (fan on/off × light tier × soil), promote per skill rules.
**Do NOT touch:** sim engine, `balance.yaml`, 3D bud viewer (frozen).
**Acceptance:** equipping each gear category produces a visible chamber change at phone size;
goldens promoted; no frame-rate regression; reduced-motion honored.
**Sonnet prompt:** *"Run /handoff-audit. Branch `claude/gv-o03-pod-equipment-visuals` from fresh
main. Implement ROADMAP_90D_2026Q3.md §2 week 4: real fan/PPFD-driven chamber climate + glow,
equipped-gear chips, fan sway (reduced-motion safe), soil substrate tint, in-store apply
deep-link (S5). capture-shots goldens for the matrix; web gates green. /closeout: one draft PR
`feat(chamber): the pod shows equipped gear and its effects`."*

---

## 3. Month 2 — Own what you grow

### Week 5 · `claude/gv-o04-cure-mint-integrity`
**Purpose:** the cure→mint state machine can't strand, lie, or pay zero.
**Build:** block mint while `cure_status == "curing"` (C5/D4) with a clear error + web gate;
PENDING self-heal on retry — if a mint retry finds `PENDING` older than a threshold, query the
provider (mock/testnet) for the asset: found → complete to MINTED, absent → compensate to NONE
(C6; the *full* reconciliation job stays p22); staking reward switches to appraised value ×
`reward_pct` (C1/D2 — **owner approves the number first**; attach Economy Balancer sim to the
PR); cure clock moves to the player-effective clock with a wall-clock floor (C8/D3 — owner
confirms); marketplace-wrap without a linked wallet returns a friendly "link your wallet"
payload the web renders as a CTA, not a raw error (C9). Backend tests for every seam the audit
called untested (mid-cure mint, PENDING recovery, unsold-mint staking reward, turbo cure).
**Do NOT touch:** withdraw/deposit/settlement math, mainnet config, metadata hash pattern.
**Protected-surface gate applies** (touches mint path + a faucet number): Security-Reviewer
checklist + owner sign-off in the PR body.
**Acceptance:** all four seams tested; no path leaves a harvest permanently PENDING; a real
(unsold→minted→staked) harvest earns > 0; D2/D3 owner decisions recorded in DECISIONS.md.

### Week 6 · `claude/gv-o05-wallet-claim-unification`
**Purpose:** one wallet story; every CTA honest.
**Build:** standardize on the challenge/sign/link stack (`web/src/lib/chain/algorand/wallet.ts` +
the signed-challenge proof from PR #169); factions Connect runs the real link flow (N5); retire
or backend-wire the arcade ChainRow dead-end mint (N4 — recommend retire; the real mint arrives
in o06); TokenClaimBanner either claims something real or states the grant already happened
(N7); NFT empty-state copy matches actual flag state (N6/C10); type the stake payload
(N8); rename the staking surface per owner's D5 pick so "curing" means only the quality cure
(C7). Web tests for the link flow + renamed surfaces.
**Do NOT touch:** staking math (just renamed UI), chain provider.
**Acceptance:** one wallet stack in the bundle; a wallet linked from factions shows on profile;
zero CTAs that dead-end; D5 recorded in DECISIONS.md.

### Week 7 · `claude/gv-o06a-wallet-preview-watcher` *(= roadmap p07a + p07b)*
As specced in GROWVERSE_ROADMAP Phase 7: WalletConnect (Pera/Defly) polish, **preview-before-sign
modal** (asset, fee, receiver, decoded `gpe` note, loud TESTNET badge), transaction-watcher
service + `txn_log` migration + replay protection (lease/idempotency), watcher chips in the
wallet panel, explorer deep-links. CI stays keyless (mock provider).
**Protected-surface gate applies.** Owner testnet click-test + watcher capture in the PR body.

### Week 8 · `claude/gv-o06b-seed-nft-claim` *(= p07c, extended to seeds — the owner's #1 ask)*
**Purpose:** a player can claim their seed as a dynamic NFT on testnet, end-to-end, in the
shipped product.
**Build (per audit D1 — port, don't wire):**
1. Port the Clone Room seed-ASA logic into the Python game API: player-scoped
   `POST /players/<pid>/seeds/<seed_id>/claim-nft` (auth + rate-limit + Idempotency-Key) that
   mints `GPSEED` ARC-3/ARC-19 via the existing provider ABC and the `seed_metadata` builder
   (`chain/metadata.py`), DB-first idempotent like `MintingService._mint`. The legacy TS
   api-server is untouched and stays archived (N1, N2).
2. **One asset registry:** every mint path (seed claim, harvest mint, marketplace wrap) records
   into `NFTAsset` (N3). The claim ceremony: preview modal (o06a) → sign → watcher lifecycle →
   asset lands in the player's collection with explorer link.
3. Claim surfaces: seed inventory rows and the post-purchase toast get "Claim seed NFT"
   (wallet-linked players; others get the link-wallet CTA from o05); collection shows seed NFTs
   with lineage traits.
4. Lazy-mint-at-harvest ceremony from p07c for harvest NFTs rides the same rails.
**Do NOT touch:** settlement/withdraw/deposit, mainnet, `MAX_WITHDRAWAL_PER_DAY`, economy numbers.
**Protected-surface gate applies:** Security-Reviewer checklist + owner testnet click-test
(mint a seed NFT on testnet from the UI) + watcher capture in the PR body.
**Acceptance:** owner claims a seed NFT on testnet through the full preview→sign→watcher→
collection flow; CI green with zero keys; every asset row reconciles to exactly one registry;
e2e (mock chain) covers buy-seed→claim→collection.
**Sonnet prompt:** *"Run /handoff-audit. Branch `claude/gv-o06b-seed-nft-claim` from fresh main.
Implement ROADMAP_90D_2026Q3.md §3 week 8: port seed-ASA mint into the game API behind the
provider ABC, single NFTAsset registry for all mint paths, claim UX riding the o06a preview +
watcher, testnet only, keyless CI. Tests + mock-chain e2e. Protected-surface gate items in the
PR body. /closeout: one draft PR `feat(chain): player seed-NFT claim on testnet (one asset
registry)`."*

---

## 4. Month 3 — Alive, guided, measured

- **Week 9 · `claude/gv-p02-game-loop-codex`** — exactly as GROWVERSE_ROADMAP Phase 2, plus
  events for the new surfaces: `gear_equip`, `gear_effect_tick` (aggregated), `seed_claim_*`,
  `cure_start/finish`, `mint_*` funnel. The telemetry answers "did equipment effects change
  behavior/retention?"
- **Week 10 · `claude/gv-p03-pod-visual-moods`** — as specced in the roadmap; builds directly on
  o03's chamber work (moods + rarity aura + mutation markers; reduced-motion; goldens).
- **Week 11 · `claude/gv-p05-scout-reports` slice 1** — as specced (mock provider, card UI), with
  one addition: the extractor includes equipped-gear + effective-env deltas so the Scout can say
  *"humidity 68% and rising — your oscillating fan is helping; consider the exhaust upgrade"* —
  advice that maps to a real store button (the store finally being real makes the Scout's
  recommended-action loop closable).
- **Week 12 · `claude/gv-o07-flags-e2e-hardening`** — web reads `GET /api/game/flags` and the 5
  no-op flags actually gate (BACKLOG #4/#5, N10 stub honesty, C11 web-test debt); full-loop
  Playwright e2e: buy seed → plant → equip fan/soil/light → apply consumable → harvest → cure
  (countdown) → mint (mock) → claim path visible; route-crash sweep extended to any new routes.

---

## 5. Decision gates (owner) — schedule-critical

| When | Decision | Blocks |
|---|---|---|
| Before w2 | D7 effect numbers (conservative defaults proposed in §2) | o02 merge |
| Before w5 | D2 staking-reward basis + pct · D3 cure clock · D4 mint-mid-cure | o04 |
| Before w6 | D5 staking-surface rename pick | o05 |
| Before w7 | D1 port-vs-wire confirmation (recommended: port) | o06a/b |
| w8 | Owner testnet click-test (seed claim) | o06b merge |
| Anytime pre-launch | D6 seed cost 0→25 (p08, unchanged) | p18 |
| Before w2 second slot | Owner-taste call: keep or delete `VideoHero.tsx` + `public/media/*` (BACKLOG #21) | o02b completeness |
| Week 5 (owner tap, ops) | Attach Fly Redis (`fly redis create` → `RATELIMIT_STORAGE_URI`) so rate limits stop being per-worker in prod | INCIDENTS 🟡 closure |
| Before w12 | D9 — confirm intended semantics of the 5 no-op flags before they start gating for real (BACKLOG #4 notes "owner OK needed") | o07 |
| Pre-launch (not 90d-blocking) | D8 — App-Store strain-name/THC% abstraction approach (BACKLOG 0d: fictional names? THC bands?) | p18/p19 |

Every decision lands in [DECISIONS.md](DECISIONS.md) when made.

---

## 6. What this plan deliberately does NOT do (unchanged from GROWVERSE_ROADMAP)

Mainnet anything · fiat rail · funds-path rewrites (withdraw/deposit/settlement math) · 3D bud
viewer · generative genetics · depth-2+ agent chains · HeyGen. This 90-day plan front-loads the
owner's priorities without abandoning the 22-phase arc — §8 below places every remaining phase
and backlog item explicitly.

---

## 8. Full absorption register — every open item, placed (2026-07-07 sweep)

Sweep of BACKLOG.md (all ⬜/🔨), HANDOFF.md open risks, INCIDENTS.md, and the 22 GrowVerse
phases. Every item lands in exactly one bucket. BACKLOG snapshot numbers in parentheses.

**Scheduled in weeks 1–12** (primary or second slot — see §1/§1b):
store correctness + double-click purchase guard (w1) · docs chores #6 #7 #8 + stale PRs
#151/#152 + HANDOFF gate #29 (w1b) · equipment sim effects S3/E1/E2 (w2–3) · dead-code retirement
#17 #21 + DB-backup workflow (w2b) · pod equipment visuals S4/S5 (w4) · finished-backend wiring
#20 (w4b) · cure/mint integrity C1/C5/C6/C8/C9 (w5) · general Idempotency-Key #1/#25 (w5b) ·
wallet/CTA unification N4–N8/C7 (w6) · **p04** plant-state ext + metadata projection (w6, 2nd
track) · lecture-audio unify #13 (w6b) · **p07a+b** preview + watcher (w7) · **p07c-extended**
seed-NFT claim N1–N3 (w8) · **p02** telemetry (w9) · care-ack/welcome-back #22 (w9b) · **p03**
moods (w10) · chamber mobile follow-ups #12 (w10b) · **p05** Scout slice 1 (w11) · onboarding
AI-guide rework #9 (w11) · **p06** knowledge layer + 14 banks #14–#16 + University playtest
fixes (w11–12) · flags #4/#5 (D9) + full-loop e2e #28 + N10 stub honesty (w12).

**Queued weeks 13+ — the arc resumes in GROWVERSE_ROADMAP order** (next-branch pointer advances
here after w12): **p05 slice 2** (live Haiku + budget guard) → **p08** economy v1 (D6 seed cost;
boost-economy #23 decisions ride here) → **p09** genetics UI → **p10** player missions → **p11**
TDE/Agent OS → **p12** runtime guard → **p13** security pass — absorbs: PR #104 follow-ups #3
(deposit redesign, CSP nonce, CORS allowlist, player key off localStorage), chain-settlement
verification #2/#24 (treasury funding, `ASA_ID`, deposit txid verify), trust-layer remainder
#30, observability/secrets/age-gating #39 → **p14** UI master → **p15** assets → **p16**
data/evals — absorbs Global Learning Memory #18 (design/11 P1/P2) → **p17** QA/sim — absorbs
load/soak `/state` #27 → **p18** MVP — absorbs playtesting/retention tail #19, D8
strain-name/THC abstraction (0d), education-gated Master Grower #33 candidacy → **p19–p22**
(community, revenue, execution machine upkeep, beta hardening — p22 absorbs the chain
reconciliation job).

**Covered by scheduled work (no separate item):** non-custodial Pera/WalletConnect path #38
(= o06a/b) · KB enrichment #32 partially (= p06; the strain-data enrichment tail stays with
p06 follow-up) · web e2e smoke #28 (= o07).

**Parked — explicit gate, not forgotten:** anti-bot framework #26 (player scale) ·
bud/flower/macro polish #11/#34 (owner visual freeze — owner names the gap) · Constellation
leaf-mesh #31 (low, cosmetic) · generative genetics #35, grower-skill mastery #36, LiveOps
sprint 6 #37, sponsored content #41 (all post-MVP by design) · fiat rail #40 (owner-parked,
5 decisions) · AI-assistance package #23-AI (5 owner gates) · PARKED PRs #27/#28 (do not
modify, per BACKLOG).

**Stale-ticked this sweep:** BACKLOG 0b (harvest stage/alive gate) verified shipped in PR #164
(`services/game_service.py:1136-1140`) — ticked ✅ in the same PR as this register.

If Sonnet finds an open item not named in this register, that's a bug in this doc — add it to
the right bucket in the same PR (memory never lies).

## 7. Standing execution rules for Sonnet (unchanged, restated)

Start every session with `/handoff-audit`; end with `/closeout` (gates green, BACKLOG
reconciled, baton + EXECUTION_MACHINE pointer updated, exactly one draft PR). One branch at a
time, from fresh `main`, named as scheduled above. Respect every "Do NOT touch". Protected
surfaces (`chain/`, migrations, `balance.yaml` numbers, wallet UI, auth, lockfiles) follow
`docs/BUILD_RULES.md` — checklist + owner click-test in the PR body. CI keyless, always. When
the audit and this plan disagree with the code, **the code wins** — fix the doc in the same PR.

### 7b. End-of-session contract (owner directive 2026-07-07 — NON-NEGOTIABLE)

A session is not finished until ALL of these hold, verified — not assumed:

1. **`main` is green.** The last merged PR's CI passed; if a session's merge (or anything else)
   broke `main`, fixing `main` **preempts all roadmap work** — diagnose, fix, re-kick until the
   default branch's checks pass. Never end the day with a red `main`.
2. **The loop is closed.** The full Session Loop ran for the branch: build → gates
   (`make test` · `make lint` · `make check-memory` · alembic · web checks as touched) → verify
   end-to-end behavior → `/closeout` → pointer + baton + BACKLOG updated → exactly one draft PR
   opened. No half-run loops, no "will finish next session" gates.
3. **GitHub is the truth the owner sees.** Every commit is **pushed** — nothing exists only in
   the local working tree or a local branch. Before ending: `git status` is clean,
   `git log origin/<branch>..<branch>` is empty (zero unpushed commits), and the open PR on
   github.com shows the exact same diff as the local branch. The owner must be able to open
   GitHub in a browser and see precisely the repo state the session ends with — local and cloud
   identical, every PR's description current, every finished branch's PR open (draft) and
   CI-triggered.
4. **Nothing is silently parked.** If work genuinely can't finish (blocked on an owner decision
   or a real defect out of scope), it is still committed + pushed on its branch, its PR body
   says exactly what's missing and why, and the baton's NEXT ACTION names it. Unpushed work at
   session end is treated as lost work.

Sonnet has (and must use) all the tools this requires: the full git CLI for branch/commit/push,
the GitHub MCP tools for PR create/update/CI-status/checks, the repo gates (`make test`,
`make lint`, `make check-memory`, web `typecheck/lint/build/vitest/e2e`), the `verify` and
`capture-shots` skills, and the `/handoff-audit`/`/closeout` session skills. "I couldn't check
CI" is not an end state — check it, and if it's red, work it.

---

*Adopted 2026-07-07 (owner directive, Fable 5 planning session). Companion evidence:
[AUDIT_NFT_STORE_LOOP.md](AUDIT_NFT_STORE_LOOP.md). Sequencing mechanics:
[EXECUTION_MACHINE.md](EXECUTION_MACHINE.md) — its Current Position pointer now tracks this
schedule through week 12, then reverts to the 22-phase order.*
