<div align="center">

# 📡 Glossary — Speak the Language

**[⬅ Mission Control](../../README.md)** ·
[🚀 Getting Started](getting-started.md) ·
[📖 Game Manual](game-manual.md) ·
[🧠 Strategy Guide](strategy-guide.md) ·
[🧬 Strain Codex](strain-codex.md) ·
[🪙 Tokenomics](tokenomics.md) ·
[🛸 Lore](lore.md) ·
[📡 Glossary](glossary.md)

*Every term, stat, and acronym in the Empire — one quick-scan reference.*

</div>

---

## 🅰️ Core terms

| Term | Definition |
|---|---|
| **GROW** | The in-game currency (symbol **GC**); a 6-decimal `Decimal`, maps 1:1 to the Algorand ASA. |
| **Pod** | A growing chamber that holds plants and carries an environment. Tiers: Basic / Standard / Pro. |
| **Strain** | A genetic line in the catalog. 16 ship at launch; you create more by breeding. |
| **Seed** | A purchasable instance of a strain that you plant to start a grow. |
| **Plant** | A living, simulated instance of a strain growing in a pod. |
| **Harvest** | The product of a finished grow — has weight, quality, rarity, and actual THC. |
| **Genome** | A plant/strain's full set of 9 traits with values + dominance flags. |
| **Trait** | One heritable property (e.g. `thc`, `yield`, `vigor`). |
| **Stability** | How true a line breeds (0–1). 1.0 = landrace/true-breeding. Gates NFT minting. |
| **Generation** | How many crosses deep a line is. Landraces = 0. |
| **Rarity** | Tier driving seed cost & sale value: common → uncommon → rare → epic → legendary. |
| **Ledger** | The append-only record of every GROW movement; the economy's source of truth. |
| **ASA** | Algorand Standard Asset — the on-chain form of GROW. |
| **NFT** | An ARC-3 non-fungible token; minted from rare harvests or stabilized rare strains. |

---

## 🌱 Traits (the 9 genes)

| Trait | Range | Visible? | Effect |
|---|---|:--:|---|
| `indica_ratio` | 0.0–1.0 | ✅ | Indica↔sativa balance |
| `thc` | 0–35% | ✅ | Potency; **+4% sale value per point over 15%** |
| `cbd` | 0–25% | ✅ | CBD content |
| `flowering_time` | 45–120 days | ✅ | Length of the flowering stage |
| `yield` | 50–800 g | ✅ | Base harvest weight |
| `difficulty` | 1–5 | ✅ | How fussy the grow is (1 = easy) |
| `disease_resistance` | 0.0–1.0 | 🫥 hidden | Resists mildew |
| `pest_resistance` | 0.0–1.0 | 🫥 hidden | Resists bugs |
| `vigor` | 0.0–1.0 | 🫥 hidden | General hardiness |

---

## 🩺 Plant state & stats

| Stat | Meaning | Key thresholds |
|---|---|---|
| `water_level` | Medium moisture | optimal 40–78 · >88 over · >96 rot · <15 wilt · decays 1.5/hr |
| `nutrient_level` | Feed level | optimal 35–82 · >95 burn · <20 deficient · decays 1.0/hr |
| `pest_level` | Infestation severity | spawns 1.2%/hr (+3% if humidity ≥62); grows 1.6/hr |
| `disease_level` | Mildew severity | sets in >64% humidity; grows 1.3/hr |
| `health` | Overall vitality | drifts 12%/hr to stressor target; **dies at ≤1.0** |
| `height` | Size in cm | grows by stage: seedling 0.6, veg 2.2, flowering 0.5 cm/day |
| `growth_stage` | Lifecycle phase | seed→germination→seedling→vegetative→flowering→harvest |
| `condition_flags` | Active issues | list of `{condition, severity}` the UI renders |

---

## ⚠️ Conditions

| Condition | Trigger |
|---|---|
| `overwatered` | water sustained > 88 |
| `root_rot` | water > 96 |
| `underwatered` | water < 15 |
| `wilting` | sustained underwatering |
| `nutrient_burn` | nutrients > 95 |
| `nutrient_deficient` | nutrients < 20 |
| `pest_infestation` | pests spawned (worsens until treated) |
| `mildew` | humidity > 64% (clears slowly when dry) |

---

## 🔬 Mechanics & systems

| Term | Definition |
|---|---|
| **Compute-on-read catch-up** | The sim advances a plant in fixed 1-hour steps up to "now" whenever it's read — no background worker needed. |
| **Deterministic sim** | Each hour seeds RNG from `(plant.id, hour)`, so the same moment always yields the same state. |
| **Segregation variance** | Random spread in offspring traits, scaled by parental instability (`1 − min(stab_a, stab_b)`). |
| **Dominance** | `dominant` / `recessive` / `codominant`; governs how a trait blends in a cross (dom×rec = 75/25, else mean). |
| **Stabilization** | Selfing/backcrossing to raise stability **+0.15 per generation**. |
| **Faucet** | A source that adds GROW (grant, stipend, sales, achievements, contracts). |
| **Sink** | A use that removes GROW (seeds, treatments, pods, fees). |
| **Burn** | GROW permanently destroyed — the 5% marketplace sale tax. Anti-inflation. |
| **Quality factor** | Sale multiplier `0.5 + 0.5 × (q/100)^1.5`, range 0.5–1.0. |
| **THC bonus** | Sale multiplier `1 + max(0, thc−15) × 0.04`. |
| **Soft cap** | Harvest grams above **120 g** are worth only **0.6×** each. |
| **Automation** | Pro pods auto-refill water (below 45→72) and nutrients (below 40→72). |

---

## 💱 Economy quick-reference

| Item | Value |
|---|---|
| Starting grant | 500 GROW |
| Daily stipend | 50 GROW / 22h |
| Seeds | common 25 · uncommon 62.5 · rare 150 · epic 375 · legendary 1000 |
| Nutrients / pest / disease | 5 / 15 / 20 |
| Pods | basic 100 · standard 400 · pro 1200 |
| Breeding fee | 75 + avg parent tier × 40 |
| Sale base | 2.0 GROW/gram |
| Rarity sale mult | common 1.0 · uncommon 1.4 · rare 2.2 · epic 4.0 · legendary 8.0 |
| Market fees | 3% listing + 5% sale tax (burned) |
| XP | harvest 25 · breed 40 · mint 60 |
| Level curve | `xp_to_reach(L) = 50 × L × (L−1)` |
| Achievements total | 1,700 GROW |
| Contracts | common 100g→250 · uncommon 80g→400 · rare 60g→700 (7-day) |

---

## ⛓️ On-chain terms

| Term | Definition |
|---|---|
| **ARC-3** | Algorand NFT metadata standard used for strain/harvest NFTs. |
| **TestNet** | Algorand's test network — where GROW lives pre-launch (no real value). |
| **Mock chain** | An offline, deterministic in-memory chain used in dev/tests (no funds, no secrets). |
| **Treasury** | The account that creates/holds assets in the custodial launch model. |
| **Idempotent mint** | Re-minting an already-minted asset returns it unchanged (no double-mint). |
| **DB-first / chain-second** | Mint writes the DB first, then the chain; chain failure marks the row `FAILED`. |
| **Custodial** | Treasury holds assets; the DB records ownership (launch model). |
| **Non-custodial** | Future Pera/WalletConnect flow transferring assets to a player's own wallet. |

---

<div align="center">

### ▶ Back to the action

**[🚀 Getting Started](getting-started.md)** ·
**[📖 Game Manual](game-manual.md)** ·
**[🧠 Strategy Guide](strategy-guide.md)**

**[⬆ Back to top](#-glossary--speak-the-language)** · **[⬅ Mission Control](../../README.md)**

<sub>GrowPod Empire · Glossary · 🌌</sub>

</div>
