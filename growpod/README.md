<!-- ╔═══════════════════════════════════════════════════════════════════════╗ -->
<!-- ║   GROWPOD EMPIRE · MISSION CONTROL · README HUB                        ║ -->
<!-- ╚═══════════════════════════════════════════════════════════════════════╝ -->

<div align="center">

```
  .      *       .          .        *           .         *      .        .
     .       ____                 ____           _   _____                  *
   *        / ___|_ __ _____  __ |  _ \ ___   __| | | ____|_ __ ___  _ __    .
      .    | |  _| '__/ _ \ \/ / | |_) / _ \ / _` | |  _| | '_ ` _ \| '_ \    .
   *       | |_| | | | (_) >  <  |  __/ (_) | (_| | | |___| | | | | | |_) |  *
     .      \____|_|  \___/_/\_\ |_|   \___/ \__,_| |_____|_| |_| |_| .__/ .
        .        ·  a persistent cannabis-grow empire in orbit  ·    |_|
  *        .          *        .          .       *        .        .     *
```

# 🛰️  GrowPod Empire — Mission Control

### *Grow. Breed. Trade. Stabilize. Mint. Conquer the orbital greenhouse.*

A persistent-economy cultivation **game**: real genetics & crossbreeding, a
deterministic real-time grow simulation, an auditable `GROW` ledger economy, and
an Algorand on-chain asset layer where your rarest strains become NFTs.

<br/>

![Status](https://img.shields.io/badge/STATUS-IN__ORBIT-22C55E?style=for-the-badge&labelColor=0B0E2C)
![Phase](https://img.shields.io/badge/BUILD-Phases_1--3_+_expansion-7C3AED?style=for-the-badge&labelColor=0B0E2C)
![Tests](https://img.shields.io/badge/TESTS-139_green-22C55E?style=for-the-badge&labelColor=0B0E2C)
![Chain](https://img.shields.io/badge/ALGORAND-TestNet-000000?style=for-the-badge&labelColor=0B0E2C)
![License](https://img.shields.io/badge/LICENSE-MIT-FACC15?style=for-the-badge&labelColor=0B0E2C)

</div>

---

<div align="center">

### 📡  CHOOSE YOUR FLIGHT PLAN

*Everything you need to play, master, and understand the Empire.*

</div>

<table>
<tr>
<td width="33%" valign="top">

### 🚀 [Getting Started](docs/manual/getting-started.md)
**New pilot? Start here.**
Your first hour: claim your grant, buy a seed, raise a plant from sprout to
harvest, and make your first sale — step by step.

</td>
<td width="33%" valign="top">

### 📖 [Game Manual](docs/manual/game-manual.md)
**The complete reference.**
Every system, every stat, every threshold, every API endpoint. The encyclopedia
of how the Empire actually works under the hood.

</td>
<td width="33%" valign="top">

### 🧠 [Strategy Guide](docs/manual/strategy-guide.md)
**Master-class min-maxing.**
The exact formulas, optimal build orders, breeding meta, economy math, and the
fastest routes to a stabilized, mintable, money-printing line.

</td>
</tr>
<tr>
<td width="33%" valign="top">

### 🧬 [Strain Codex](docs/manual/strain-codex.md)
**The orbital seed vault.**
A Pokédex-style catalog of all 16 founding strains — full genome stats,
terpene profiles, difficulty, and a breeding tier list.

</td>
<td width="33%" valign="top">

### 🪙 [Tokenomics](docs/manual/tokenomics.md)
**The GROW economy & token.**
Faucets, sinks, the burn, the Algorand ASA, supply schedule, and the live
**Token Observatory** price ticker.

</td>
<td width="33%" valign="top">

### 🛸 [Lore](docs/manual/lore.md)
**What makes us different.**
The story of the orbital greenhouse, the Empire's mission, and the philosophy
behind a grow-game you can actually *own*.

</td>
</tr>
<tr>
<td width="33%" valign="top">

### 📡 [Glossary](docs/manual/glossary.md)
**Speak the language.**
Every term, acronym, and stat defined in one quick-scan reference.

</td>
<td width="33%" valign="top">

### 🗺️ [Roadmap](docs/ROADMAP.md)
**Where the Empire is heading.**
The 90-day flight plan: sprints, exit criteria, and what ships next.

</td>
<td width="33%" valign="top">

### 🛠️ [API Reference](docs/manual/game-manual.md)
**For builders & bots.**
The REST surface — pair the manual's API chapter with the live, generated
`GET /openapi.json` + Swagger UI at `/docs` to automate your whole operation.

</td>
</tr>
</table>

---

## ⭐ What is GrowPod Empire?

You command a pod — a sealed growing chamber in an orbital greenhouse. Inside it,
plants are **simulated in real time**: they drink, feed, droop, attract pests,
catch mildew, recover, and flower on their own genetic clock. Neglect a plant and
it withers; tend it well and it rewards you at harvest.

But cultivation is only the engine. The **game** is the loop around it:

```
        ┌─────────────────────────────────────────────────────────────┐
        │                                                               │
   ╭────▼────╮   ╭─────────╮   ╭─────────╮   ╭──────────╮   ╭────────╮  │
   │  GROW   │──▶│  CARE    │──▶│ HARVEST │──▶│ SELL or  │──▶│ BREED  │──┘
   │ a seed  │   │ the sim  │   │ by health│   │  TRADE   │   │ a line │
   ╰─────────╯   ╰─────────╯   ╰─────────╯   ╰──────────╯   ╰───┬────╯
                                                                 │
                            ╭───────────╮   ╭──────────────╮     │
                            │   MINT    │◀──│  STABILIZE    │◀────╯
                            │  an NFT   │   │ the new strain│
                            ╰───────────╯   ╰──────────────╯
```

- 🌱 **Real genetics** — 9 inheritable traits, dominance, segregation variance,
  and deterministic, replayable crossbreeding.
- ⏱️ **Real-time simulation** — compute-on-read catch-up advances every plant in
  fixed 1-hour steps; the world keeps growing while you're away.
- 💰 **An auditable economy** — every `GROW` movement is one append-only ledger
  row with a balance snapshot. Faucets feed you; sinks fight inflation.
- 💎 **On-chain ownership** — stabilize a rare line and mint it as an Algorand
  ARC-3 NFT. The DB stays authoritative; the chain is the trophy case.
- 🤖 **AI Master Grower** — an advisor reads a plant's live state and recommends
  care (and can run **agentic auto-care** within a spend cap). Powered by Claude
  when a key is set, with an offline deterministic fallback.
- 🌿 **Depth systems** — a post-harvest **curing** stage, **terpene** genetics, a
  15-node **research tree**, a **consumables shop**, and **seasonal strains**.

→ Read the full story in the **[Lore](docs/manual/lore.md)**.

---

## 🚀 Quick Launch (run it yourself)

```bash
# 1. Install
pip install -r requirements.txt

# 2. Create the schema + seed the 16 founding strains (idempotent)
alembic upgrade head
python -m growpodempire.db.seed

# 3. Serve the API  →  http://localhost:10000
python server.py

# 4. (Optional) Launch the web client
cd web && npm install && npm run dev   #  →  http://localhost:3000
```

Run against the **mock chain** out of the box (no secrets, no funds). To mint for
real on Algorand TestNet, see the **[Tokenomics](docs/manual/tokenomics.md)**
chapter. Full setup details live in **[Getting Started](docs/manual/getting-started.md)**.

---

## 🧭 Find your way around

| If you want to… | Go to |
|---|---|
| Play for the first time | 🚀 [Getting Started](docs/manual/getting-started.md) |
| Look up exactly how a mechanic works | 📖 [Game Manual](docs/manual/game-manual.md) |
| Win — fast, optimally | 🧠 [Strategy Guide](docs/manual/strategy-guide.md) |
| Pick the best strain to grow or breed | 🧬 [Strain Codex](docs/manual/strain-codex.md) |
| Understand the money & the token | 🪙 [Tokenomics](docs/manual/tokenomics.md) |
| Know what a word means | 📡 [Glossary](docs/manual/glossary.md) |
| Automate with the API | 🛠️ [Game Manual · API](docs/manual/game-manual.md) + `GET /openapi.json` |
| See what's coming | 🗺️ [Roadmap](docs/ROADMAP.md) |

---

<div align="center">

### 🛰️ Built for the long haul

`Phase 1` Persistent DB + ledger economy + genetics  ·  `Phase 2` Real-time grow
sim  ·  `Phase 3` Algorand ASA + ARC-3 NFTs

Simulation & entertainment only. No real cannabis is grown, sold, or shipped.
Age-gating and compliance framing apply — see the [Roadmap](docs/ROADMAP.md).

<br/>

**[ 🚀 Getting Started ](docs/manual/getting-started.md)** ·
**[ 📖 Manual ](docs/manual/game-manual.md)** ·
**[ 🧠 Strategy ](docs/manual/strategy-guide.md)** ·
**[ 🧬 Codex ](docs/manual/strain-codex.md)** ·
**[ 🪙 Token ](docs/manual/tokenomics.md)** ·
**[ 🛸 Lore ](docs/manual/lore.md)**

<sub>GrowPod Empire · MIT Licensed · Made among the stars 🌌</sub>

</div>
