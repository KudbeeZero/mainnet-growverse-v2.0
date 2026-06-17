<div align="center">

# 📖 Game Manual — The Complete Reference

**[⬅ Mission Control](../../README.md)** ·
[🚀 Getting Started](getting-started.md) ·
[📖 Game Manual](game-manual.md) ·
[🧠 Strategy Guide](strategy-guide.md) ·
[🧬 Strain Codex](strain-codex.md) ·
[🪙 Tokenomics](tokenomics.md) ·
[🛸 Lore](lore.md) ·
[📡 Glossary](glossary.md)

*The encyclopedia of how the Empire actually works. Every system, every number,
every endpoint. If a mechanic exists, it's documented here.*

</div>

---

## 📑 Table of contents

1. [The big picture](#1--the-big-picture)
2. [Players, accounts & auth](#2--players-accounts--auth)
3. [The economy & the ledger](#3--the-economy--the-ledger)
4. [Pods](#4--pods)
5. [Seeds & strains](#5--seeds--strains)
6. [Genetics & traits](#6--genetics--traits)
7. [Crossbreeding](#7--crossbreeding)
8. [Strain stabilization](#8--strain-stabilization)
9. [The grow simulation](#9--the-grow-simulation)
10. [Plant conditions & reactions](#10--plant-conditions--reactions)
11. [Harvesting & selling](#11--harvesting--selling)
12. [The marketplace & auctions](#12--the-marketplace--auctions)
13. [NPC contracts](#13--npc-contracts)
14. [Weather](#14--weather)
15. [Pod automation](#15--pod-automation)
16. [Progression: XP, levels & achievements](#16--progression-xp-levels--achievements)
17. [Leaderboards](#17--leaderboards)
18. [On-chain: ASA & NFTs](#18--on-chain-asa--nfts)
19. [API reference](#-api-reference)
20. [Data models](#-data-models)
21. [Configuration](#-configuration)

> 💡 Every number in this manual is sourced from the live tuning file
> `data/balance.yaml` and the genetics specs. The game reads its constants from
> there, so what you see here is what the game actually does.

---

## 1 · The big picture

GrowPod Empire is a **server-authoritative cultivation game**. The database is
the source of truth; the Algorand chain is a settlement/mirror layer. The core
gameplay loop:

```
 grow a seed → care for it via the live sim → harvest (yield ∝ health)
   → sell to the NPC market OR list on the player marketplace
   → buy/breed new genetics → stabilize a line over generations
   → mint your rarest, truest line as an on-chain NFT → trade & flex
```

Three engineering pillars (each has its own deep-dive doc under `docs/`):

| Pillar | What it gives you | Deep dive |
|---|---|---|
| **Persistence + economy** | A real save + an auditable `GROW` ledger | [`docs/PHASE1_ECONOMY_DB.md`](../PHASE1_ECONOMY_DB.md) |
| **Real-time simulation** | Plants that live, suffer, and react | [`docs/PHASE2_SIMULATION.md`](../PHASE2_SIMULATION.md) |
| **On-chain layer** | ASA currency + ARC-3 strain/harvest NFTs | [`docs/PHASE3_ONCHAIN.md`](../PHASE3_ONCHAIN.md) |

---

## 2 · Players, accounts & auth

- Creating a player credits a one-time **starting grant of 500 GROW**.
- Each player gets an **API key**, shown once at creation. It authorizes every
  **write** action via the `X-API-Key` header. **Reads are public.**
- A player tracks: `handle`, `balance` (derived from the ledger), `xp`, `level`,
  optional `algorand_address`, achievements, and timestamps for the daily claim.

> 🔒 Lose the API key → lose write access to that account. There is no recovery
> flow in the launch model; guard it.

---

## 3 · The economy & the ledger

All money is the in-game currency **`GROW`** (symbol `GC`), stored as a
6-decimal `Decimal` — **never a float** — so it can map 1:1 to the Algorand ASA.

### The ledger is the source of truth

Every single movement of GROW is **one append-only row** in `ledger_entries`,
each carrying a `balance_after` snapshot. Your balance is always reconstructable
and auditable. Nothing edits a balance directly.

### Faucets (GROW enters the economy)

| Faucet | Amount | Notes |
|---|---:|---|
| Starting grant | **500** | One-time, at account creation |
| Daily stipend | **50** | Once per **22h** cooldown |
| Harvest sale | variable | The main earner — see [§11](#11--harvesting--selling) |
| Achievements | 100–500 each | One-time — see [§16](#16--progression-xp-levels--achievements) |
| Contract rewards | 250–700 | Timed deliveries — see [§13](#13--npc-contracts) |

### Sinks (GROW leaves the economy — fights inflation)

| Sink | Cost |
|---|---:|
| Seed purchase | 25 × rarity multiplier |
| Nutrient application | 5 |
| Pest treatment | 15 |
| Disease treatment | 20 |
| Pod — Basic / Standard / Pro | 100 / 400 / 1200 |
| Breeding fee | 75 + (avg parent tier × 40) |
| Marketplace listing fee | 3% of price (at listing) |
| Marketplace sale tax | 5% of proceeds (**burned**) |

The marketplace **sale tax is burned** — permanently removed from supply — which
is the primary anti-inflation pressure as the player economy grows.

---

## 4 · Pods

A pod is a growing chamber that holds plants and carries an environment
(temperature, humidity, CO₂, light, pH). Higher tiers cost more and unlock
**automation**.

| Tier | Cost (GROW) | Automation |
|---|---:|---|
| **Basic** | 100 | None |
| **Standard** | 400 | Auto-**water** only |
| **Pro** | 1200 | Auto-**water** + auto-**feed** (see [§15](#15--pod-automation)) |

Pods can also be **upgraded** in place (paying the price difference) rather than
rebuilt.

The pod's environment feeds directly into the simulation. Deviations from the
optimal bands sap plant health, and humidity drives pests & disease.

**Pod environment optimal bands:**

| Parameter | Optimal | Hard clamp (weather) |
|---|---|---|
| Temperature | **20–28 °C** | 10–40 |
| Humidity | **40–60 %** | 10–95 |
| pH | **6.0–7.0** | 4.0–9.0 |
| CO₂ | (informational) | 300–2000 ppm |
| Light | (informational) | 0–1000 |

Defaults when a pod has no sensor snapshot yet: temp **24**, humidity **50**, pH
**6.5** — all optimal, so a fresh pod starts penalty-free.

---

## 5 · Seeds & strains

A **strain** is a genetic line in the catalog (16 founders ship at launch; you
create more by breeding). A **seed** is a purchasable instance of a strain that
you plant to start a grow.

**Seed price = 25 × rarity multiplier:**

| Rarity | Multiplier | Seed cost |
|---|---:|---:|
| Common | 1.0× | **25** |
| Uncommon | 2.5× | **62.5** |
| Rare | 6.0× | **150** |
| Epic | 15.0× | **375** |
| Legendary | 40.0× | **1000** |

The full founding catalog with every stat is in the **[Strain Codex](strain-codex.md)**.

---

## 6 · Genetics & traits

Every strain has a **genome**: 9 traits, each with a value, a valid range, a
dominance flag, and a *segregation sigma* (how much offspring vary).

| Trait | Range | σ (frac. of range) | Visible? | What it does |
|---|---|---:|---|---|
| `indica_ratio` | 0.0–1.0 | 0.12 | ✅ | Indica↔sativa balance |
| `thc` | 0–35 % | 0.10 | ✅ | Potency — drives sale value bonus |
| `cbd` | 0–25 % | 0.12 | ✅ | CBD content |
| `flowering_time` | 45–120 days | 0.08 | ✅ | Length of the flowering stage |
| `yield` | 50–800 g | 0.10 | ✅ | Base harvest weight |
| `difficulty` | 1–5 | 0.10 | ✅ | How fussy it is to grow |
| `disease_resistance` | 0.0–1.0 | 0.12 | 🫥 hidden | Resists mildew |
| `pest_resistance` | 0.0–1.0 | 0.12 | 🫥 hidden | Resists bugs |
| `vigor` | 0.0–1.0 | 0.10 | 🫥 hidden | General hardiness |

- **Visible traits** drive display stats and value. **Hidden traits**
  (resistances, vigor) silently shape how the plant behaves in the simulation but
  still inherit through breeding.
- **Dominance** is one of `dominant`, `recessive`, or `codominant`. It governs
  how a trait blends in a cross (see [§7](#7--crossbreeding)).
- **Stability** (0–1) is *not* a trait but a line property: how true it breeds.
  Landraces are 1.0 (true-breeding); fresh hybrids are lower and segregate more.

Lower stability also **widens the displayed stat ranges** (e.g. `thc_min`…
`thc_max`) — an unstable line is a roll of the dice; a stabilized one is a known
quantity.

---

## 7 · Crossbreeding

`cross(parent_a, parent_b, rng, …)` produces an offspring genome. It is
**deterministic** for a given RNG seed — and that seed is stored on every
`BreedingEvent`, so any cross can be replayed and audited.

**For each of the 9 traits:**

1. **Blend by dominance** →
   - dominant × recessive → `0.75 × dominant + 0.25 × recessive`
   - equal footing (both dominant, both recessive, or codominant) → simple mean.
2. **Add segregation variance** → a Gaussian nudge with
   `σ = trait.sigma_frac × trait.range × instability`, where
   `instability = 1 − min(stability_a, stability_b)`.
   - **Stable parents breed true** (σ→0). **Unstable parents scatter.**
3. **Clamp** to the trait's legal range (ints rounded).
4. **Inherit a dominance flag** — 75% chance to carry a dominant parent's flag,
   else 50/50.

**Offspring line properties:**

- **Stability:** `min(1.0, avg(stab_a, stab_b) × 0.6 + 0.1)` — *fresh F1 crosses
  are deliberately unstable.* You earn stability back through stabilization.
- **Generation:** `max(gen_a, gen_b) + 1`.
- **Rarity:** starts from the **higher** parent's tier, then ±:
  - `+1.0` if THC ≥ 28, `+0.5` if THC ≥ 24
  - `+0.5` if yield ≥ 650
  - `+1.0` if stability ≥ 0.85, `+0.5` if stability ≥ 0.7
  - then **−1 tier** baseline (fresh crosses usually drop a tier), clamped to
    `common…legendary`.

➡️ Translation: a *stabilized, high-THC, high-yield* novel cross can **climb**
rarity tiers. That is the prestige loop that ultimately gates NFT minting.

The **breeding fee** = `75 + (avg parent rarity tier × 40)`, where tiers are
common=0, uncommon=1, rare=2, epic=3, legendary=4.

---

## 8 · Strain stabilization

A fresh cross is unstable and won't mint. **Stabilize** it by selfing/backcrossing
across generations. Each stabilize generation raises the line's stability by
**+0.15**.

- NFT eligibility needs **stability ≥ 0.85** (and rarity ≥ rare, and you must be
  the creator).
- From a typical F1 (~0.4–0.55 stability), that's roughly **2–3 stabilize
  generations**.
- As stability rises, the displayed stat ranges **tighten** — the line becomes a
  reliable, known product worth minting and trading.

The optimal stabilization route is in the **[Strategy Guide](strategy-guide.md#-the-stabilize--mint-engine)**.

---

## 9 · The grow simulation

Plants grow in **real time** via **compute-on-read catch-up**. Each plant stores
`last_tick_at`; whenever it's read or acted on, the engine advances it in **fixed
1-hour steps** up to now. No background worker is required, and the trajectory is
**deterministic** — each hour seeds its RNG from `(plant.id, hour)`, so reading at
any wall-clock moment yields the same result.

> A single catch-up is capped at **8760 hours (1 year)** for safety.

### What every plant tracks

`water_level`, `nutrient_level`, `pest_level`, `disease_level`, `health`,
`height`, `growth_stage`, and `condition_flags` (a machine-readable list of
`{condition, severity}` the frontend renders).

### Resource decay (per hour)

| Resource | Decay/hr | Optimal band | Danger |
|---|---:|---|---|
| Water | **1.5** | 40–78 | >88 overwatered · >96 root rot · <15 wilting |
| Nutrients | **1.0** | 35–82 | >95 burn · <20 deficient |

### Player actions

| Action | Effect | Cost |
|---|---|---:|
| Water | water_level **+35** | free |
| Feed | nutrient_level **+30** | 5 GROW |
| Treat pests | clears pests | 15 GROW |
| Treat disease | clears disease | 20 GROW |
| Set environment | sets pod temp/humidity/CO₂/light/pH | free |

### Stage timeline (days)

| Stage | Duration | Growth (cm/day @ full health) |
|---|---:|---|
| Seed | 3 | — |
| Germination | 5 | — |
| Seedling | 10 | 0.6 |
| Vegetative | 26 | 2.2 |
| Flowering | **= strain `flowering_time`** (45–120) | 0.5 |
| Harvest | — | — |

So total grow time ≈ `3 + 5 + 10 + 26 + flowering_time` days. A 56-day flowering
strain (e.g. Afghani) finishes in ~**100 days** of real elapsed time; the world
keeps ticking while you're logged off.

---

## 10 · Plant conditions & reactions

Conditions are emitted by a **pure mapping** from plant levels → flags, each with
a `Severity`. The web client animates them (droop, crawling bugs, mildew pulse,
oily sheen).

| Condition | Trigger | Severity grows when… |
|---|---|---|
| `overwatered` | water sustained > 88 | water climbs toward 96 |
| `root_rot` | water > 96 | extreme saturation persists |
| `underwatered` | water < 15 | water keeps falling |
| `wilting` | sustained underwatering | left unwatered |
| `nutrient_burn` | nutrients > 95 | overfeeding continues |
| `nutrient_deficient` | nutrients < 20 | starvation continues |
| `pest_infestation` | pests spawned | **+1.6 / hr** until treated |
| `mildew` | humidity > 64 | **+1.3 / hr**; clears slowly in dry air |

### Pests & disease dynamics

- **Pests** spawn stochastically: base **1.2%/hr**, **+3%/hr** when humidity ≥
  62%. Low `pest_resistance` genetics raise susceptibility. Once present,
  infestation worsens **+1.6/hr** until you treat it.
- **Disease (mildew)** sets in above **64% humidity**, grows **+1.3/hr**, and
  clears slowly once the air dries. Low `disease_resistance` raises risk.

### Health

Health **drifts toward a target** set by all active stressors, closing **12% of
the gap per hour** (`drift_rate = 0.12`). Stressor weights on the health target:

| Stressor | Weight |
|---|---:|
| Water stress | 0.60 |
| Nutrient stress | 0.50 |
| Environment stress | 0.50 |
| Pest level | 0.45 / point |
| Disease level | 0.55 / point |

If sustained catastrophe drives health to **≤ 1.0 (death threshold)**, the plant
**dies**. Health at harvest determines yield and quality — so health *is* money.

---

## 11 · Harvesting & selling

Harvesting runs catch-up first, so **yield scales with the plant's actual
health** and quality reflects how it was grown.

### Sale value formula (NPC market)

```
value = effective_weight × 2.0 × rarity_mult × thc_bonus × quality_factor
```

| Term | Definition |
|---|---|
| `base_price_per_gram` | **2.0 GROW/g** |
| `rarity_mult` | common 1.0 · uncommon 1.4 · rare 2.2 · epic 4.0 · legendary 8.0 |
| `thc_bonus` | `1 + max(0, thc − 15) × 0.04` → **+4% value per THC point above 15%** |
| `quality_factor` | `0.5 + 0.5 × (quality/100)^1.5` → maps 0–100 quality to a **0.5–1.0** multiplier |
| `effective_weight` | full grams up to **120 g**; grams above the soft cap count at **0.6×** |

> 📉 **Diminishing returns above 120 g.** Mega-yield strains still win, but each
> gram past 120 is worth only 60% — quality and THC scale *without* a cap, so they
> compound harder. (Full worked examples in the
> **[Strategy Guide](strategy-guide.md#-the-harvest-value-formula-decoded)**.)

After selling, GROW lands in your ledger and you gain harvest XP.

---

## 12 · The marketplace & auctions

Player-to-player trading runs alongside the NPC market.

- **Fixed-price listings:** seller pays a **3% listing fee** up front; on sale, a
  **5% tax is withheld and burned**.
- **Auctions:** bid-based with **escrowed bids, automatic refunds** to outbid
  players, expiry, and **highest-bidder settlement**. Same fee/tax structure
  funds the burn.

Both fees are GROW **sinks** — they're the economy's release valve against
inflation.

---

## 13 · NPC contracts

Timed delivery orders. Draw a contract offer, deliver (fulfill) the target grams
of the right rarity before the deadline, and get paid in GROW **and** XP.

- **Duration:** 7 days each.
- Offers are drawn from weighted templates:

| Rarity | Target | Reward | XP | Draw weight |
|---|---:|---:|---:|---:|
| Common | 100 g | 250 | 30 | 3 |
| Uncommon | 80 g | 400 | 50 | 2 |
| Rare | 60 g | 700 | 90 | 1 |

The **rare** contract pays the best GROW-per-gram and XP — if you can reliably
grow rare-tier weight, it's the highest-value faucet in the game.

---

## 14 · Weather

Random weather events shift a pod's environment, which then feeds the sim. Deltas
are applied to the current snapshot; `ideal` resets to optimal.

| Event | Effect | Weight |
|---|---|---:|
| Heatwave | temp +7, humidity −12 | 2 |
| Cold snap | temp −7, humidity +6 | 2 |
| Humidity spike | humidity +20 | 2 |
| Dry spell | humidity −20 | 2 |
| Ideal | set temp 24 / humidity 50 / pH 6.5 | 1 |

All values are clamped to the hard ranges in [§4](#4--pods). Weather is the main
source of *uncontrolled* pest/disease risk — a humidity spike can ignite mildew if
you're not watching.

---

## 15 · Pod automation

Higher pod tiers top up resources automatically when they run low — the same
top-up the sim would credit a diligent player. **Which resources are automated
depends on the tier:**

| Tier | Auto-water | Auto-feed |
|---|:--:|:--:|
| Basic | ❌ | ❌ |
| **Standard** | ✅ | ❌ |
| **Pro** | ✅ | ✅ |

Automation thresholds:

| Resource | Refills when below | Refills to |
|---|---:|---:|
| Water | 45 | 72 |
| Nutrients | 40 | 72 |

A **Standard pod** auto-waters (killing the overwater/underwater failure modes); a
**Pro pod** also auto-feeds, so it babysits both water *and* nutrients — freeing you
to focus on pests, disease, environment, and weather. Neither tier treats
pests/disease — those always need you.

---

## 16 · Progression: XP, levels & achievements

### XP & levels

XP is awarded for meaningful actions; level is derived from **cumulative** XP via
a quadratic curve.

```
xp_to_reach(level L) = curve_base × L × (L − 1) / 2     (curve_base = 100)
                     = 50 × L × (L − 1)
```

| Action | XP |
|---|---:|
| Harvest | 25 |
| Breed | 40 |
| Mint | 60 |

| Level | Cumulative XP needed |
|---:|---:|
| 2 | 100 |
| 3 | 300 |
| 4 | 600 |
| 5 | 1,000 |
| 10 | 4,500 |
| 20 | 19,000 |

### Achievements (one-time GROW rewards)

| Achievement | Trigger | Reward |
|---|---|---:|
| First Harvest | Harvest your first plant | 100 |
| First Breed | Breed a new strain | 150 |
| First NFT | Mint your first NFT | 250 |
| Green Thumb | Complete 5 harvests | 300 |
| Master Breeder | Breed 5 strains | 500 |
| High Roller | Hold 2000 GROW | 400 |

**Total achievement payout: 1,700 GROW.** Plan your early game to sweep these.

---

## 17 · Leaderboards

Global rankings across four categories:

- 💰 **Richest** — highest GROW balance
- 🧬 **Top breeders** — most strains bred
- 🌿 **Biggest harvest** — single largest harvest
- ⭐ **Highest level** — most XP/level

Leaderboards are public reads — chase the categories that match your build.

---

## 18 · On-chain: ASA & NFTs

The GROW currency maps to an Algorand **ASA**; rare/stabilized strains and premium
harvests can mint as **ARC-3 NFTs** — on **TestNet** first. The **DB ledger stays
authoritative**; the chain is a settlement/mirror, so a clean reset never touches
balances.

### Eligibility

| Asset | Requirement |
|---|---|
| Harvest NFT | rarity ≥ **rare** |
| Strain NFT | you are the `created_by`, **stability ≥ 0.85**, rarity ≥ **rare** |

### Mint flow

DB-first / chain-second and **idempotent** — an already-minted asset returns
unchanged (no double-mint); a chain failure marks the row `FAILED`.

### Going live (optional)

Out of the box the game uses an offline **mock chain** (no funds, no secrets). To
mint for real on TestNet, set a funded treasury mnemonic and ASA config — see
**[Tokenomics → Going on-chain](tokenomics.md#7--going-on-chain-testnet)** and
[`docs/PHASE3_ONCHAIN.md`](../PHASE3_ONCHAIN.md).

> The legacy hand-rolled SHA-256 `blockchain/` is **superseded** by real Algorand
> assets + the `plant_events` log; it survives only to keep old endpoints
> responding and is slated for removal.

---

## 🔌 API reference

Base path: `/api/game`. **Reads are public; writes require `X-API-Key`.** The
authoritative, machine-readable spec is served live at **`/openapi.json`** with a
Swagger UI at **`/docs`**.

### Players, economy & progression

| Method · Path | Purpose |
|---|---|
| `POST /players` | Create a player (+500 GROW, returns API key) |
| `GET /players/<pid>` | Player profile |
| `GET /players/<pid>/wallet` | Current balance |
| `GET /players/<pid>/level` | XP & level progress |
| `GET /players/<pid>/ledger` | Audit trail of every GROW movement |
| `POST /players/<pid>/daily` | Claim the daily stipend (+50, 22h cooldown) |
| `GET /players/<pid>/achievements` | Achievement status |
| `POST /players/<pid>/achievements/<key>/claim` | Claim an earned achievement reward |
| `GET /leaderboards/<board>` | Rankings (e.g. `richest`, `breeders`, `harvest`, `level`) |
| `GET /players/<pid>/pods` · `…/plants` · `…/seeds` | List the player's pods / plants / seeds *(read-only)* |

### Strains, favorites & breeding

| Method · Path | Purpose |
|---|---|
| `GET /strains` · `GET /strains/<id>` | Browse / inspect the catalog (search & filter) |
| `GET /players/<pid>/favorites` | List favorited strains |
| `POST` / `DELETE /players/<pid>/strains/<id>/favorite` | Add / remove a favorite |
| `POST /players/<pid>/seeds/buy` | Buy seed(s) — body `{strain_id, quantity?}` |
| `POST /players/<pid>/breed` | Cross two strains — body `{parent_a_id, parent_b_id, name?}` |
| `POST /players/<pid>/strains/<id>/stabilize` | Selfing/stabilize a line (+0.15 stability) |

### Pods & planting

| Method · Path | Purpose |
|---|---|
| `POST /players/<pid>/pods` | Build a pod — body `{name, tier?, capacity?}` |
| `POST /players/<pid>/pods/<pod>/upgrade` | Upgrade a pod's tier — body `{tier}` |
| `POST /players/<pid>/pods/<pod>/environment` | Set temp/humidity/CO₂/light/pH |
| `POST /players/<pid>/pods/<pod>/weather` | Roll/apply a weather event on the pod |
| `POST /players/<pid>/plant` | Plant a seed — body `{seed_id, pod_id}` |

### The grow loop (simulation)

| Method · Path | Purpose |
|---|---|
| `GET /players/<pid>/plants/<id>/state` | Live simulated state (runs catch-up) + recent events |
| `GET /plants/<id>/events` | The plant's event log |
| `POST /players/<pid>/plants/<id>/water` | Water (optional `amount`) |
| `POST /players/<pid>/plants/<id>/feed` | Feed nutrients (bills cost) |
| `POST /players/<pid>/plants/<id>/treat-pests` | Clear pests (bills cost) |
| `POST /players/<pid>/plants/<id>/treat-disease` | Clear disease (bills cost) |

### Harvest

| Method · Path | Purpose |
|---|---|
| `POST /players/<pid>/plants/<id>/harvest` | Harvest (yield & quality computed server-side from health). Body `{sell?}` — **`sell` defaults to `true`, which sells to the NPC market in the same call.** Set `sell:false` to keep the harvest (e.g. to fill a contract or mint it). |

> ℹ️ There is **no separate "sell" endpoint** — selling to the NPC market is the
> default behavior of `harvest`. Keep a harvest (`sell:false`) when you intend to
> deliver it to a contract, list it on the marketplace, or mint it.

### Marketplace & contracts

| Method · Path | Purpose |
|---|---|
| `GET /market` | Browse active listings & auctions |
| `POST /players/<pid>/market/list` | Create a fixed-price listing (3% listing fee) |
| `POST /players/<pid>/market/auction` | Create an auction |
| `POST /players/<pid>/market/<id>/bid` | Place a bid (escrowed; outbids refunded) |
| `POST /players/<pid>/market/<id>/buy` | Buy a fixed-price listing |
| `POST /players/<pid>/market/<id>/settle` | Settle an expired auction to the top bidder |
| `GET /players/<pid>/contracts` | List the player's contracts |
| `POST /players/<pid>/contracts/offer` | Draw a new contract offer |
| `POST /players/<pid>/contracts/<id>/fulfill` | Deliver grams to fulfill a contract |

### On-chain (wallet, settlement & NFTs)

| Method · Path | Purpose |
|---|---|
| `POST /players/<pid>/wallet/link` | Link an Algorand address |
| `POST /players/<pid>/wallet/withdraw` · `…/deposit` | Mirror GROW between the ledger and the ASA |
| `POST /players/<pid>/harvests/<id>/mint` | Mint an eligible harvest NFT |
| `POST /players/<pid>/strains/<id>/mint` | Mint a stabilized rare strain NFT |
| `GET /nft/<kind>/<id>.json` | Serve the ARC-3 metadata |

### API reference

The full REST surface is **self-describing and generated** — it never drifts
from the code: `GET /openapi.json` for the OpenAPI 3 spec, and Swagger UI at
`/docs`. The legacy v1.0 in-memory endpoints (`/api/pods`, `/api/plants`, …) have
been removed; everything lives under `/api/game/*`.

### Health & ops

| Path | Purpose |
|---|---|
| `GET /health` | Liveness probe |
| `GET /readiness` | Readiness probe (DB reachable, etc.) |
| `GET /openapi.json` · `/docs` | OpenAPI 3 spec + Swagger UI |

---

## 🗃️ Data models

| Model | Key fields |
|---|---|
| **Player** | handle, balance (ledger-derived), xp, level, algorand_address, achievements |
| **Pod** | tier, name, environment snapshot (temp/humidity/CO₂/light/pH), automation |
| **Strain** | name, lineage_type, rarity, stability, genome, terpenes, created_by, generation, nft_asset_id |
| **Seed** | strain reference, owner |
| **Plant** | strain genome (copied), water/nutrient/pest/disease levels, health, height, growth_stage, last_tick_at, condition_flags |
| **Harvest** | weight_g, quality, rarity, thc_actual, nft_asset_id |
| **LedgerEntry** | player, delta, reason, balance_after, timestamp *(append-only)* |
| **BreedingEvent** | parents, rng seed, offspring strain *(replayable)* |
| **PlantEvent** | plant, event type, severity, timestamp |
| **Contract** | rarity, target grams, reward, xp, deadline, status |
| **Listing / Auction / Bid** | item, price, fees, bids, expiry, settlement |

---

## ⚙️ Configuration

- **All economic & simulation constants** live in `data/balance.yaml`. No magic
  numbers in code — balance is data-driven and hot-tunable.
- **The strain catalog** lives in `data/strains.yaml`, seeded idempotently by
  `db/seed.py`.
- **Database:** SQLite in dev, Postgres in prod (`DATABASE_URL`). Schema via
  Alembic (`alembic upgrade head`).
- **Chain:** mock by default; set `ALGO_TREASURY_MNEMONIC`, `ALGOD_URL`,
  `ASA_ID`, etc. to go live (`USE_MOCK_CHAIN=true` forces the mock). See
  [`.env.example`](../../.env.example).

---

<div align="center">

### ▶ Keep reading

**[🧠 Strategy Guide — turn this knowledge into wins](strategy-guide.md)** ·
**[🧬 Strain Codex](strain-codex.md)** ·
**[🪙 Tokenomics](tokenomics.md)**

**[⬆ Back to top](#-game-manual--the-complete-reference)** · **[⬅ Mission Control](../../README.md)**

<sub>GrowPod Empire · Game Manual · 🌌</sub>

</div>
