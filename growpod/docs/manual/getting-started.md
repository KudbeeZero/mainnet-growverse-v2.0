<div align="center">

# 🚀 Getting Started — Your First Orbit

**[⬅ Mission Control](../../README.md)** ·
[🚀 Getting Started](getting-started.md) ·
[📖 Game Manual](game-manual.md) ·
[🧠 Strategy Guide](strategy-guide.md) ·
[🧬 Strain Codex](strain-codex.md) ·
[🪙 Tokenomics](tokenomics.md) ·
[🛸 Lore](lore.md) ·
[📡 Glossary](glossary.md)

`Estimated time to first harvest-sale: one play session of setup + real grow time.`

</div>

---

> 🛰️ **Welcome aboard, pilot.** You've just been handed the keys to a pod in the
> orbital greenhouse. This guide walks you from a cold boot to your first sale.
> No prior knowledge required. When you're done, jump to the
> **[Strategy Guide](strategy-guide.md)** to start winning.

---

## 0. Pre-flight checklist

You can play three ways. Pick one:

| Way to play | Best for | Where to look |
|---|---|---|
| 🌐 **Web client** | Most players — see your plant react live | [Web client](#path-a--web-client-recommended) |
| 🔌 **REST API** | Builders, bots, automation | [API quickstart](#path-b--rest-api) |
| 🖥️ **CLI** | Quick local pokes | [CLI](#path-c--cli) |

All three talk to the same backend and the same `GROW` economy.

### System boot (one-time)

```bash
# From the repo root
pip install -r requirements.txt

# Build the database and plant the 16 founding strains in the catalog.
# Safe to re-run — seeding is idempotent.
alembic upgrade head
python -m growpodempire.db.seed

# Start the server  →  http://localhost:10000
python server.py
```

The server runs against an **offline mock blockchain** by default — no wallet, no
funds, no secrets needed. Everything in this guide works on the mock. (Real
Algorand TestNet minting is optional and covered in
**[Tokenomics](tokenomics.md)**.)

---

## Path A — Web client (recommended)

```bash
cd web
npm install
npm run dev        #  →  http://localhost:3000
```

1. Open `http://localhost:3000`.
2. **Onboarding** creates your player and shows your **API key once** — copy it
   somewhere safe. It's your identity for every write action.
3. You land on the **dashboard**. Follow the in-app prompts, or keep reading —
   the steps below map 1:1 to the UI buttons.

> 🔑 **The API key is shown exactly once.** If you lose it you lose write access
> to that account. Treat it like a save file.

---

## Path B — REST API

Every example uses `curl`. Reads are public; **writes need your API key** in the
`X-API-Key` header. Full endpoint list: **[Game Manual → API](game-manual.md#-api-reference)**.

### 1. Create your player → claim **500 GROW**

```bash
curl -s -X POST http://localhost:10000/api/game/players \
  -H 'Content-Type: application/json' \
  -d '{"handle": "stardust_grower"}'
```

The response includes your `player_id` **and your `api_key`**. Save both. You're
credited a one-time **starting grant of 500 GROW** (`starting_grant`).

```bash
# Save them as shell vars for the rest of this guide
export PID="<player_id from the response>"
export KEY="<api_key from the response>"
```

### 2. Claim your daily stipend → **+50 GROW**

```bash
curl -s -X POST http://localhost:10000/api/game/players/$PID/daily \
  -H "X-API-Key: $KEY"
```

You can claim **+50 GROW** once every **22 hours**. Free money — never skip it.

### 3. Build a pod

A pod is the chamber your plant lives in. Start with a **Basic** pod.

```bash
curl -s -X POST http://localhost:10000/api/game/players/$PID/pods \
  -H "X-API-Key: $KEY" -H 'Content-Type: application/json' \
  -d '{"tier": "basic", "name": "Orbit One"}'
# Basic pod = 100 GROW. Standard (400) auto-waters; Pro (1200) auto-waters & feeds.
export POD="<pod_id from the response>"
```

### 4. Browse the catalog & buy a seed

```bash
# List the founding strains (public read)
curl -s http://localhost:10000/api/game/strains | head

# Buy a COMMON seed for 25 GROW (rarer seeds cost more — see the Codex)
curl -s -X POST http://localhost:10000/api/game/players/$PID/seeds/buy \
  -H "X-API-Key: $KEY" -H 'Content-Type: application/json' \
  -d '{"strain_id": "<a common strain id, e.g. Blue Dream>", "quantity": 1}'
export SEED="<seed_id from the response>"
```

> 🌿 **Beginner pick:** start with an *easy, forgiving* strain — **Northern
> Lights**, **Hindu Kush**, or **White Widow** (difficulty 1–2, good
> resistances). See the **[Strain Codex](strain-codex.md)**.

### 5. Plant the seed

```bash
curl -s -X POST http://localhost:10000/api/game/players/$PID/plant \
  -H "X-API-Key: $KEY" -H 'Content-Type: application/json' \
  -d '{"seed_id": "'$SEED'", "pod_id": "'$POD'"}'
export PLANT="<plant_id from the response>"
```

Your seed's genome is copied onto the plant. The clock starts now.

### 6. Tend the plant (the core loop)

Read the live state — this **runs the simulation up to "now"** before answering:

```bash
curl -s http://localhost:10000/api/game/players/$PID/plants/$PLANT/state
```

Watch `water_level`, `nutrient_level`, `health`, and `condition_flags`. Act when
levels drift:

```bash
# Water (raises water_level ~+35).  Keep water between 40 and 78.
curl -s -X POST .../plants/$PLANT/water        -H "X-API-Key: $KEY"
# Feed nutrients (~+30, costs 5 GROW). Keep nutrients between 35 and 82.
curl -s -X POST .../plants/$PLANT/feed          -H "X-API-Key: $KEY"
# If bugs appear (costs 15 GROW)
curl -s -X POST .../plants/$PLANT/treat-pests   -H "X-API-Key: $KEY"
# If mildew appears (costs 20 GROW)
curl -s -X POST .../plants/$PLANT/treat-disease -H "X-API-Key: $KEY"
```

> ⚠️ **Don't drown it.** Water *decays ~1.5/hr*; nutrients *~1.0/hr*. Topping up
> too often pushes you past **88 (overwatered)** → **96 (root rot)**. Patience
> beats panic. Full thresholds: **[Game Manual → Simulation](game-manual.md#9--the-grow-simulation)**.

### 7. Harvest → sell → get paid

When the plant finishes flowering, harvest it. **Yield and quality scale with the
health you kept it at** — neglect costs you grams and GROW. Harvesting **sells to
the NPC market in the same call** (`sell` defaults to `true`):

```bash
# Harvest AND sell to the NPC market in one call (sell defaults to true)
curl -s -X POST http://localhost:10000/api/game/players/$PID/plants/$PLANT/harvest \
  -H "X-API-Key: $KEY"

# OR keep the harvest (to fill a contract, list it, or mint it):
curl -s -X POST http://localhost:10000/api/game/players/$PID/plants/$PLANT/harvest \
  -H "X-API-Key: $KEY" -H 'Content-Type: application/json' -d '{"sell": false}'
```

🎉 **First harvest** unlocks the `first_harvest` achievement (**+100 GROW**).

---

## Path C — CLI

```bash
python cli.py --help          # see all commands
python cli.py create-pod ...   # create a chamber
python cli.py add-plant ...    # add a plant
python cli.py record-growth ...# log a measurement
python cli.py stats            # system snapshot
python cli.py serve            # start the API server
```

The CLI is handy for quick local checks; the web client and API are where the
full game loop lives.

---

## 🎯 Your first-session goals

Tick these off and you've graduated from rookie to grower:

- [ ] Create a player (**+500 GROW**)
- [ ] Claim the daily stipend (**+50 GROW**)
- [ ] Build a Basic pod (**−100 GROW**)
- [ ] Buy + plant a common, easy seed (**−25 GROW**)
- [ ] Keep water in **40–78** and nutrients in **35–82** through one read cycle
- [ ] Survive a pest or mildew outbreak with one treatment
- [ ] Harvest and sell → unlock **First Harvest** (**+100 GROW**)
- [ ] Read the **[Strategy Guide](strategy-guide.md)** before your second grow

---

## 💸 Starting-budget math

You begin with **500 GROW**. A safe opening:

| Buy | Cost | Running balance |
|---|---:|---:|
| Starting grant | +500 | **500** |
| Daily stipend | +50 | **550** |
| Basic pod | −100 | **450** |
| One common seed | −25 | **425** |
| ~6 feedings over the grow | −30 | **395** |
| 1 pest + 1 disease treatment | −35 | **360** |
| **First harvest sale (common, well-grown)** | **+~180–260** | **~540–620** |
| First Harvest achievement | +100 | **~640–720** |

You end your first grow **richer than you started**, with a harvest, XP, and an
achievement. That surplus is your seed capital for breeding — which is where the
**[Strategy Guide](strategy-guide.md)** takes over.

---

## 🆘 Common rookie mistakes

| Symptom | Cause | Fix |
|---|---|---|
| `overwatered` / `root_rot` | Watering on every read | Let water fall toward 40 before topping up |
| `wilting` | Forgot to water (water < 15) | Water immediately; check state more often |
| `mildew` keeps returning | Pod humidity > 64% | Lower humidity via the environment control |
| `pest_infestation` spreads | Left untreated; damp air | Treat early; keep humidity < 62% |
| Plant **died** | Health hit the death floor (≤ 1.0) | Tend sooner; pick a hardier strain |
| Low harvest value | Harvested an unhealthy plant | Quality follows health — keep it green |
| `401 / 403` on a write | Missing/wrong API key | Send `X-API-Key: <your key>` |

---

<div align="center">

### ▶ Next stop

**[🧠 Strategy Guide — start winning](strategy-guide.md)**  ·
**[🧬 Pick your strain](strain-codex.md)**  ·
**[📖 Look it all up](game-manual.md)**

**[⬆ Back to top](#-getting-started--your-first-orbit)** · **[⬅ Mission Control](../../README.md)**

<sub>GrowPod Empire · Getting Started · 🌌</sub>

</div>
