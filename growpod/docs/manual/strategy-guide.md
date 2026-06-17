<div align="center">

# 🧠 Strategy Guide — Master the Empire

**[⬅ Mission Control](../../README.md)** ·
[🚀 Getting Started](getting-started.md) ·
[📖 Game Manual](game-manual.md) ·
[🧠 Strategy Guide](strategy-guide.md) ·
[🧬 Strain Codex](strain-codex.md) ·
[🪙 Tokenomics](tokenomics.md) ·
[🛸 Lore](lore.md) ·
[📡 Glossary](glossary.md)

*The min-maxer's bible. Exact formulas, worked examples, build orders, the
breeding meta, and the fastest route to a stabilized, mintable, money-printing
line. Read the **[Game Manual](game-manual.md)** for the raw rules; read this to
**win**.*

</div>

---

## 📑 Contents

1. [Core principles](#1--the-five-core-principles)
2. [The harvest-value formula, decoded](#-the-harvest-value-formula-decoded)
3. [What actually matters: quality > THC > rarity > weight](#2--what-actually-matters)
4. [Opening build order (first 500 GROW)](#3--opening-build-order)
5. [The grow rhythm — never overwater](#4--the-grow-rhythm)
6. [The breeding meta](#5--the-breeding-meta)
7. [The stabilize → mint engine](#-the-stabilize--mint-engine)
8. [Economy mastery: faucets, sinks & the burn](#6--economy-mastery)
9. [Contracts vs NPC market vs auctions](#7--where-to-sell)
10. [Achievement speedrun (+1,700 GROW)](#8--achievement-speedrun)
11. [Leveling efficiency](#9--leveling-efficiency)
12. [Pod tier decision](#10--pod-tier-decision)
13. [Risk management: weather, pests, disease](#11--risk-management)
14. [End-game: the money printer](#12--end-game-the-money-printer)
15. [Cheat sheet](#-cheat-sheet)

---

## 1 · The five core principles

> 🛰️ **If you remember nothing else, remember these.**

1. **Health is money.** Yield *and* quality scale with the health you keep a
   plant at. A neglected plant isn't just lower yield — it's lower yield *times*
   lower quality, a double penalty.
2. **Quality and THC have no cap; weight does.** Grams above 120 are worth only
   0.6× each, but the quality and THC multipliers keep compounding. Optimize the
   uncapped levers.
3. **Stability is the prestige currency.** It gates NFT minting, tightens your
   stat ranges, and lets a line climb rarity. Every long-term plan ends in a
   stabilized line.
4. **The burn is relentless.** Player-market taxes are *destroyed*. The economy
   rewards producers, not flippers. Grow value, don't just trade it.
5. **The world ticks whether you watch or not.** Compute-on-read means a forgotten
   plant keeps drying, getting infested, and can die. Plan your check-ins around
   decay rates, not vibes.

---

## 📐 The harvest-value formula, decoded

This single formula governs most of your income. Internalize it.

```
value = effective_weight × 2.0 × rarity_mult × thc_bonus × quality_factor
```

| Lever | Formula | Range | Capped? |
|---|---|---|---|
| **base/gram** | constant | 2.0 GROW/g | — |
| **rarity_mult** | lookup | 1.0 → 8.0 (common→legendary) | discrete |
| **thc_bonus** | `1 + max(0, thc−15) × 0.04` | 1.0 → ~1.8 | no |
| **quality_factor** | `0.5 + 0.5 × (q/100)^1.5` | 0.5 → 1.0 | no |
| **effective_weight** | full to 120 g, then ×0.6 | — | **soft cap @120 g** |

### The quality curve is brutal at the bottom, generous at the top

| Quality (q) | quality_factor | vs. q=50 |
|---:|---:|---:|
| 0 | 0.500 | — |
| 25 | 0.563 | — |
| 50 | 0.677 | baseline |
| 70 | 0.793 | +17% |
| 85 | 0.892 | +32% |
| 95 | 0.963 | +42% |
| 100 | 1.000 | +48% |

Going from a sloppy q=50 grow to a clean q=95 grow is a **+42% revenue swing on
the exact same plant.** That delta is pure skill.

### The THC bonus rewards potent genetics

| THC % | thc_bonus |
|---:|---:|
| 15 | 1.00 |
| 19 | 1.16 |
| 22 | 1.28 |
| 25 | 1.40 |
| 27 | 1.48 |
| 30 | 1.60 |

### The weight soft cap

Up to 120 g, every gram is full value. Past 120 g, each extra gram is worth only
**0.6×**:

```
effective_weight = 120 + (weight − 120) × 0.6     (for weight > 120)
```

A 200 g harvest yields `120 + 80×0.6 = 168` effective grams — you "lose" 32 g of
value to diminishing returns.

### Worked example — a clean rare grow

**Gorilla Glue #4** (rare, THC 27), harvested at **120 g**, **quality 92**:

```
quality_factor = 0.5 + 0.5 × (0.92)^1.5 = 0.5 + 0.5 × 0.882 = 0.941
thc_bonus      = 1 + (27 − 15) × 0.04   = 1.48
rarity_mult    = 2.2  (rare)

value = 120 × 2.0 × 2.2 × 1.48 × 0.941 ≈ 735 GROW
```

Now run the **same plant at quality 55** (you overwatered it):

```
quality_factor = 0.5 + 0.5 × (0.55)^1.5 = 0.5 + 0.5 × 0.408 = 0.704
value = 120 × 2.0 × 2.2 × 1.48 × 0.704 ≈ 550 GROW
```

**185 GROW gone** — more than the cost of a rare seed — purely from sloppy care.

---

## 2 · What actually matters

Rank your priorities like this:

```
QUALITY  ≈  THC  >  RARITY  >  WEIGHT (up to 120g)  >>  WEIGHT (past 120g)
```

- **Quality** (skill, uncapped, up to +48%) and **THC** (genetics, uncapped, up
  to +80%) are your biggest multiplicative levers — and they stack.
- **Rarity** is huge (up to 8× at legendary) but discrete and gated behind
  breeding.
- **Weight** matters, but only to ~120 g. Chasing a 300 g monster is worse than
  growing two 120 g plants at high quality.

> 🎯 **The optimal target plant:** a **high-rarity, high-THC** strain grown to
> **~120 g at 90+ quality**. Everything in this guide is in service of producing
> that plant repeatedly — then minting the line.

---

## 3 · Opening build order

You start with **500 GROW**. Here's the optimal first moves:

```
Turn 0:  Create player            → +500   (bal 500)
Turn 0:  Claim daily stipend      → +50    (bal 550)
Turn 0:  Build BASIC pod          → −100   (bal 450)
Turn 0:  Buy 1 COMMON easy seed   → −25    (bal 425)   ← Northern Lights / Hindu Kush
Turn 0:  Plant it.
─────────────────────────────────────────────────────────────
Grow:    ~6 feeds                 → −30    (bal 395)
Grow:    1 pest + 1 disease treat → −35    (bal 360)
Harvest: sell well-grown common   → +~220  (bal ~580)
Bonus:   First Harvest achievement→ +100   (bal ~680)
```

You end your **first grow up ~180 GROW**, with XP and an achievement. **Do not**
buy a Standard/Pro pod or a rare seed on turn 0 — you can't afford the risk yet.
Bank your first two harvests, *then* invest.

**Why a common, easy seed first?** Difficulty 1–2 strains have high resistances
and forgive mistakes while you learn the decay rhythm. A botched rare seed (150
GROW) on grow #1 is a disaster; a botched common (25 GROW) is a lesson.

---

## 4 · The grow rhythm

The #1 rookie killer is **overwatering**. Master the decay math:

| Resource | Decay/hr | Action gives | Optimal band | Hard danger |
|---|---:|---:|---|---|
| Water | −1.5 | +35 | **40–78** | >88 over · >96 rot · <15 wilt |
| Nutrients | −1.0 | +30 | **35–82** | >95 burn · <20 deficient |

### The timing rule

- One **water (+35)** from the bottom of the band (40) lands you at 75 — right
  near the top. From 75, water decays back to 40 in `(75−40)/1.5 ≈ 23 hours`.
- ➡️ **Water roughly once a day, and only when water has fallen toward 40.**
  Watering at 70 pushes you to ~105 → instant root-rot territory. **Let it dry
  first.**
- Nutrients decay slower (1.0/hr). A **feed (+30)** from 40 lasts
  `(70−35)/1.0 = 35 hours`. Feed a little less often than you water.

### Read before you act

Every `GET …/state` runs catch-up, so the number you see is current. **Read
first, then decide** — never blind-water. If water reads 70, do nothing.

### The "let it ride" insight

Because the sim is deterministic catch-up, a plant left at a *stable, healthy
equilibrium* will coast. The danger is **environment drift** (weather) spiking
humidity and igniting pests/mildew. So your real job between waterings is
**watching humidity**, not babysitting water.

---

## 5 · The breeding meta

Breeding is where wealth compounds. The engine:

- Each trait **blends by dominance** (dominant×recessive → 75/25; else mean),
  then gets **Gaussian variance** scaled by `instability = 1 − min(stab_a,
  stab_b)`.
- **Stable parents breed true; unstable parents scatter.**
- Offspring **stability = avg(parents) × 0.6 + 0.1** (fresh crosses are
  deliberately unstable).
- Offspring **rarity** starts at the *higher* parent's tier, then:
  `+1` if THC≥28, `+0.5` if THC≥24, `+0.5` if yield≥650, `+1` if stab≥0.85,
  `+0.5` if stab≥0.70 — then **−1 baseline**, clamped.

### How to climb rarity tiers

To push offspring *up* a tier, you need the rarity score to beat the baseline −1.
That means stacking bonuses. The cleanest combos:

- **High THC both parents** → offspring THC likely ≥24–28 (`+0.5` to `+1`).
- **Stabilize before you mint** → `+1` at stability ≥0.85.
- **A high-yield parent** (≥650 g) → `+0.5`.

> 🧬 **The tier-climb recipe:** cross two **high-THC** parents (e.g. Gorilla Glue
> #4 × Girl Scout Cookies, both 25–27% THC), select the highest-THC offspring,
> then **stabilize it to ≥0.85**. THC bonus + stability bonus can lift a rare F1
> into epic territory — and epics/legendaries sell at **4×/8×** rarity multiplier.

### Variance is your friend early, your enemy late

- **Early (exploration):** breed *unstable* crosses on purpose and grow several
  offspring — wide segregation means some roll high THC/yield. Keep the winners.
- **Late (exploitation):** once you've found a winner, **stabilize it** so it
  breeds true and its displayed ranges tighten into a premium, mintable product.

### Breeding cost

`fee = 75 + avg_parent_tier × 40` (tiers: common 0 … legendary 4).

| Cross | avg tier | Fee |
|---|---:|---:|
| common × common | 0 | 75 |
| uncommon × uncommon | 1 | 115 |
| rare × rare | 2 | 155 |
| rare × epic | 2.5 | 175 |
| epic × epic | 3 | 195 |

Breeding also **awards 40 XP** (your best per-action XP) and grants a seed of the
new strain, plus the **First Breed** (+150) and **Master Breeder** (+500 at 5
strains) achievements.

---

## 🏆 The stabilize → mint engine

This is the prestige loop and the end-game money printer. Goal: a **rare+,
high-THC, stability ≥ 0.85** line that you created → mint it as an NFT.

### Stabilization math

Each selfing/stabilize generation adds **+0.15 stability**. A fresh F1 from two
stable parents has stability ≈ `1.0 × 0.6 + 0.1 = 0.70`. From there:

| Generation | Stability | Mintable (≥0.85)? |
|---|---:|---|
| F1 (from 2 landraces) | ~0.70 | ❌ |
| +1 stabilize | ~0.85 | ✅ (just barely) |
| +2 stabilize | ~1.00 (capped) | ✅ true-breeding |

From a *messier* F1 (unstable parents, ~0.40–0.55), budget **2–3 stabilize
generations**.

### The full prestige route

```
1. Cross two high-THC rares          (fee ~155, +40 XP, +150 first-breed)
2. Grow several F1 offspring, pick the highest THC/yield winner
3. Stabilize the winner 1–3× to reach stability ≥ 0.85   (+0.15 each gen)
4. Confirm rarity ≥ rare (THC + stability bonuses should hold/raise it)
5. Mint the strain NFT  (+60 XP, +250 first-NFT achievement)
6. The minted, stabilized line now breeds true → premium seeds → repeat
```

Minting requires: **you are the creator**, **stability ≥ 0.85**, **rarity ≥
rare**. Harvests mint on rarity alone (≥ rare). See
**[Tokenomics](tokenomics.md)** for the on-chain side.

---

## 6 · Economy mastery

### Know your faucets and sinks

| Faucets (in) | Typical value |
|---|---|
| Starting grant | 500 (once) |
| Daily stipend | 50 / 22h — **never skip** |
| Harvest sales | your engine |
| Contracts | 250–700 each |
| Achievements | 1,700 total |

| Sinks (out) | When |
|---|---|
| Seeds, nutrients, treatments | every grow |
| Pods | upgrades |
| Breeding fees | every cross |
| Market listing fee (3%) + sale tax (5%, **burned**) | player trades |

### The burn changes how you should trade

The 5% sale tax is **destroyed**. So flipping items player-to-player **leaks
value out of your pocket and out of the economy**. Implications:

- **Sell raw harvests to the NPC market** (no tax) for predictable income.
- **Use the player marketplace for genetics/NFTs** that the NPC market won't
  price — where the premium justifies the tax.
- The richest players are **producers** (grow + breed + mint), not flippers. The
  burn is designed to make sure of it.

### Daily discipline

`+50/day × 365 = 18,250 GROW/yr` for one click. Set a habit. It funds a free seed
every other day forever.

---

## 7 · Where to sell

| Channel | Best for | Economics |
|---|---|---|
| **NPC market** | Raw harvests, steady cash | No tax; price = the harvest formula |
| **Contracts** | Planned production | Fixed reward + XP; rare = best rate |
| **Player marketplace (fixed)** | Genetics, seeds, NFTs | 3% list + 5% burn tax |
| **Auctions** | Rare one-of-a-kind items | Bid war can beat fixed price; same fees |

### Contract value analysis

| Contract | Target | Reward | GROW/gram | + XP |
|---|---:|---:|---:|---:|
| Common | 100 g | 250 | 2.50 | 30 |
| Uncommon | 80 g | 400 | 5.00 | 50 |
| Rare | 60 g | 700 | **11.67** | 90 |

The **rare contract pays ~11.7 GROW/gram** — far above the NPC base of 2.0/gram —
plus the most XP. If you can grow rare-tier weight reliably, **prioritize rare
contracts** over raw NPC sales. (Compare against the harvest formula: a rare
plant only beats 11.7 GROW/g at the NPC market with high THC *and* high quality,
so the contract is usually the better floor.)

---

## 8 · Achievement speedrun

A one-time **1,700 GROW** is sitting on the table. Optimal order:

| Order | Achievement | Reward | How |
|---|---|---:|---|
| 1 | First Harvest | 100 | Finish grow #1 |
| 2 | First Breed | 150 | Cross any two strains |
| 3 | Green Thumb | 300 | Reach 5 total harvests |
| 4 | Master Breeder | 500 | Breed 5 strains |
| 5 | First NFT | 250 | Mint a stabilized rare strain |
| 6 | High Roller | 400 | Hold 2,000 GROW at once |

> 💡 **High Roller tip:** it checks *holding* 2,000, not earning it. Time your
> claim — sell a few harvests, hold before re-investing, trip the achievement,
> *then* spend.

---

## 9 · Leveling efficiency

XP per action: **breed 40 > mint 60(once-ish) > harvest 25**. Level cost is
quadratic: `xp_to_reach(L) = 50 × L × (L−1)`.

| Goal | Cheapest path |
|---|---|
| Early levels | Harvest often (25 each) + breed (40 each) |
| Fast climb | **Breed** is the best repeatable XP; minting is 60 but gated |

| Level | XP | ≈ harvests | ≈ breeds |
|---:|---:|---:|---:|
| 5 | 1,000 | 40 | 25 |
| 10 | 4,500 | 180 | ~113 |

Breeding doubles as **XP + new genetics + achievement progress** — it's the most
efficient action in the game. When in doubt, breed.

---

## 10 · Pod tier decision

| Tier | Cost | Automation | When it pays off |
|---|---:|---|---|
| **Basic** (100) | cheap | none | Grows 1–2; learning; tight budget |
| **Standard** (400) | mid | **auto-water** | Once you're running consistent grows and overwatering is your main leak |
| **Pro** (1200) | premium | **auto-water + auto-feed** | Multiple long grows you can't babysit |

**The automation ladder matters:** Standard auto-waters but does **not** auto-feed;
only **Pro** does both. Both auto-refill water (below 45 → 72) and Pro also refills
nutrients (below 40 → 72), eliminating the overwater/underwater/starve failure
modes — the exact mistakes that tank quality.

**Pro pod ROI:** for a serious breeder running several 100-day grows in parallel,
1,200 GROW pays for itself in *saved quality* within a couple of harvests. Neither
tier treats pests/disease — you still watch humidity. You can also **upgrade** a
pod in place (paying the price difference) instead of rebuilding.

> 🪐 **Upgrade trigger:** buy a Pro pod once a single high-quality rare/epic
> harvest (~700+ GROW) covers a meaningful chunk of it and you're tending more
> plants than you can hand-water daily.

---

## 11 · Risk management

Your plant can die. Health hits the death floor at **≤ 1.0**. The threats, ranked
by how often they kill:

1. **Overwatering** (self-inflicted) → root rot → health crash. *Fix: dry-first
   watering rhythm.*
2. **Humidity-driven pests & mildew** (weather-driven) → compounding stress.
   *Fix: watch humidity; keep it 40–60%; treat early.*
3. **Underwater/starvation** (neglect) → wilting/deficiency. *Fix: regular
   check-ins or a Pro pod.*

### The humidity control point

Humidity is the master risk dial:

- **≥ 62%** → pest spawn chance jumps **+3%/hr**.
- **> 64%** → **mildew** sets in (+1.3/hr).
- A single **humidity-spike** weather event (+20) can push a 50% pod to 70% and
  ignite both. **After any weather event, check humidity and correct it** via the
  environment control.

### Genetics as insurance

Hidden traits matter: high `disease_resistance` / `pest_resistance` / `vigor`
strains shrug off outbreaks. For low-attention play, favor hardy genetics
(Afghani, Durban Poison, Northern Lights) — see the **[Codex](strain-codex.md)**.

---

## 12 · End-game: the money printer

Once you have a **stabilized, high-THC, rare+ line you created**, the loop runs
itself:

```
   ┌──────────────────────────────────────────────────────────────┐
   │  Premium seeds from your true-breeding line                    │
   │     → grow at 90+ quality in a Pro pod (low babysit)           │
   │        → harvest ~120g rare/epic at high THC                   │
   │           → fill RARE contracts (~11.7 GROW/g) + NPC overflow  │
   │              → mint standout strains/harvests as NFTs (+XP)    │
   │                 → trade NFTs/seeds on the marketplace          │
   │                    → reinvest into more pods & rarer crosses ──┘
```

**Per-cycle income (illustration):** one rare contract (700) + one extra ~120 g
rare harvest at q90 (~700) + daily stipend (50) ≈ **1,450 GROW per cycle**, before
NFT/marketplace upside — against trivial sink costs (a feed here, a treatment
there). Scale it across pods and stabilized lines and you're compounding.

### What separates the top of the leaderboard

- 💰 **Richest:** maximize NPC + contract throughput; minimize taxed trades.
- 🧬 **Top breeder:** breed constantly (cheap, +40 XP, achievement progress).
- 🌿 **Biggest harvest:** chase a high-`yield` line and grow it to its weight cap
  at high health (remember the 120 g soft cap on *value* — but the leaderboard
  ranks raw grams).
- ⭐ **Highest level:** breed-heavy play; every cross is 40 XP.

---

## 📋 Cheat sheet

```
WATER       decays 1.5/hr · band 40–78 · +35/action · DRY before refilling
NUTRIENT    decays 1.0/hr · band 35–82 · +30/action · costs 5
DANGER      water >88 over, >96 rot, <15 wilt · nutrient >95 burn, <20 starve
HUMIDITY    keep 40–60% · ≥62 pests · >64 mildew · check after every weather event
HEALTH      drifts 12%/hr to stressor target · dies at ≤1.0 · = yield × quality

SELL VALUE  weight × 2.0 × rarity_mult × thc_bonus × quality_factor
  rarity    common1.0 unc1.4 rare2.2 epic4.0 legend8.0
  thc_bonus 1 + (thc−15)×0.04
  quality   0.5 + 0.5×(q/100)^1.5
  weight    full to 120g, then ×0.6

SEEDS       common25 unc62.5 rare150 epic375 legend1000
POD         basic100 standard400 pro1200(auto water+feed)
BREED FEE   75 + avg_tier×40  ·  +40 XP  ·  offspring stab = avg×0.6+0.1
STABILIZE   +0.15/gen · mint needs stab≥0.85 + rarity≥rare + you created it
XP          breed40 > mint60 > harvest25 · level L needs 50·L·(L−1)
FAUCETS     start500 · daily50/22h · achievements1700total · rare contract700
CONTRACTS   common 100g→250 · uncommon 80g→400 · rare 60g→700 (best: 11.7/g)
```

---

<div align="center">

### ▶ Put it to work

**[🧬 Pick your breeding stock](strain-codex.md)** ·
**[🪙 Understand the token](tokenomics.md)** ·
**[📖 Look up the rules](game-manual.md)**

**[⬆ Back to top](#-strategy-guide--master-the-empire)** · **[⬅ Mission Control](../../README.md)**

<sub>GrowPod Empire · Strategy Guide · 🌌</sub>

</div>
