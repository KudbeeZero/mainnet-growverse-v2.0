# 🎓 Grower Skills & Mastery — time as the design axis

> The deep design for progression: grower-skill mastery earned by *doing*, with **real grow-time** as
> the gate that makes reputation and rare phenotypes meaningful. Tags: ✅ built · 🔨 partial ·
> ⬜ planned. This is moat #6 in `00-game-vision.md` — and the anti-whale, anti-bot fairness layer.

## Honest current state
GROWv2 already has *operation-level* progression, but **no per-grower skill mastery and no
equipment**:

- ✅ **XP & level** on the player (`Player.xp`, `Player.level`, `db/models.py`); XP from harvest/
  breed/mint (`leveling_service.py`, `balance.yaml:187`).
- ✅ **Research tree** — 15 nodes / 5 branches, **bought with GROW**, gated by level + prerequisites,
  effects aggregate additively (`research_service.py`, `balance.yaml:210`).
- ✅ **Achievements + daily stipend** retention faucets (`progression_service.py`).
- ✅ **Consumable shop** — one-shot boosters (`balance.yaml:272`).
- ⬜ **No grower skill trees** (no `skill` table/service anywhere).
- ⬜ **No equipment / gear / rooms** — pods are the only grow container; light is an env scalar, not
  a fixture (see `01-simulation-horticulture.md`).

The research tree is **spend-to-unlock** (money → upgrade). Mastery should be the opposite axis:
**do-to-unlock** (effort + time → skill). The two coexist — research is your *operation*, skills are
*you*.

---

## Grower skill trees ⬜
Use-based skills, leveled by performing the activity well (not by spending GROW), distinct from
research:

| Domain | Mastery unlocks (examples) | Earned by |
|--------|----------------------------|-----------|
| **Cultivation** | Tighter VPD/EC tolerances, faster healthy growth | Bringing plants to harvest in good health |
| **Plant health / IPM** | Earlier pest/disease detection, cheaper/stronger treatments | Diagnosing & recovering struggling plants |
| **Nutrient science** | Read deficiency symptoms, dial EC/pH precisely | Feeding without burn/lockout |
| **Breeding / genetics** | Better odds on rare alleles, see more of a genome, larger crosses | Completing crosses & stabilizations |
| **Post-harvest / curing** | Wider cure windows, higher quality ceiling | Curing harvests near-optimally |
| **Operations** | Throughput, automation efficiency, GenBank standing | Running many grows over time |

Design notes:
- **Use-based XP per domain** (mirror `leveling_service` but per-skill); ranks unlock *capability*,
  not just stat buffs — a master breeder can attempt crosses a novice literally can't.
- **Effects layer in `services/`, never in the engine** — same rule as research (ARCHITECTURE).
- **Skills gate technique; they don't bypass the sim.** A skill widens your safe VPD band; it doesn't
  delete VPD. This keeps the simulation authoritative (`00-game-vision.md` §Anti-goals).

---

## Time as the gate — "growing doesn't happen overnight"
Time is the core design axis, not a nuisance to pay-to-skip:
- **Grows take real days** (stage durations in `balance.yaml:133`; flowering is genetic). That's a
  *feature* — it makes a finished cultivar an investment.
- **Mastery accrues only through completed cycles**, so a long-term player is genuinely ahead of a
  new whale — you can't buy the hours.
- **Rare phenotypes are earned**: discovery (`02-genetics.md`) takes many grows, and the skill to
  recognize and stabilize what you find.
- **What serious players unlock over months:** wider tolerances, higher quality ceilings, access to
  advanced crosses, reputation, and standing in the GenBank.
- **Anti-whale / anti-bot.** Because the gate is *time + earned skill*, money and automation can't
  shortcut to the top. This is a fairness moat, not just flavor.

> Tension to tune in `balance.yaml`: long cycles must reward serious players **without** stalling new
> ones. Levers: parallel pods, contracts, the daily stipend, and skill XP that rewards *quality*, not
> just *quantity*.

---

## The knowledge economy ⬜
Mastery + the AI flywheel (`00-game-vision.md` moat #7) create tradable *knowledge*, not just goods:
- **Master-grower data & consulting** — high-skill players' agronomic recipes and verified phenotype
  findings carry market value.
- **Verified findings** (first-discoverer credit, `02-genetics.md`) become reputation assets.
- **The AI Master Grower** learns from accumulated grows, raising the floor for everyone while expert
  data stays a premium edge.

---

## The equipment bridge ⬜
Equipment is the link between mastery and the deep sim, and is **deferred** ("can come down the
line") — designed for, not built now:
- Gear (lights with real spectra, HVAC/dehu, CO₂, hydro/aero setups) becomes meaningful **only when
  the sim reads it** — see `01-simulation-horticulture.md` §Cultivation methods & special equipment
  (Phase C).
- **Owning gear isn't enough; using it well is a skill** (Cultivation/Operations domains). A pro
  light in unskilled hands underperforms.

---

## Implementation sketch (design, not a build order)
For whoever picks this up — mirror existing patterns, don't invent new ones:
- **Data:** a `grower_skills:` section in `balance.yaml` shaped like `research:` (nodes, domains,
  use-based XP curves, effects) so balance stays data-driven.
- **Schema:** `GrowerSkill(player_id, skill_key, rank, xp)` and (later) `EquipmentInventory` /
  equipped-gear tables — alongside the existing player-scoped tables in `db/models.py`.
- **Service:** a `grower_skill_service.py` mirroring `research_service.py` (`*_effects()` aggregation
  applied in player-scoped code); award XP from the same hooks `leveling_service` uses.
- **Economy:** new ledger entry types for any GROW costs/rewards; **every faucet keeps a sink**
  (ARCHITECTURE / `00-game-vision.md` §Anti-goals).

## Cross-links
- The sim that mastery gates: `01-simulation-horticulture.md`.
- The genetics that breeding mastery unlocks: `02-genetics.md`.
- Why time + mastery is a moat: `00-game-vision.md` §The Moat #6.
