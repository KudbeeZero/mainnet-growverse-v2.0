# 🌿 Strain Encyclopedia — research database

> **Additive, staged data. Touches no game code.** Nothing here is loaded by the
> simulation, genetics engine, seeder, or DB. It is a growing reference library of
> real-world cannabis strains, each shaped so a vetted entry can later be **promoted**
> into the live game (`src/growpodempire/data/strains.yaml`) by hand. Built
> autonomously by a recurring research loop (see `_PROGRESS.md`).

## Why this exists
The game ships with 22 founding strains. This library expands the known universe —
lineage, chemistry, terpenes, effects, history — so we have a deep, sourced catalog
to draw from when adding strains, designing breeding metas, or writing codex/lore.

## What's here
| File | Purpose |
|---|---|
| `strains/<slug>.md` | One strain per file: full real-world profile + a ready-to-paste `game_mapping` block. |
| `INDEX.md` | Running catalog table (name, type, THC/CBD, rarity, flowering, status). |
| `_ledger.json` | Machine state: research queue, completed slugs, in-game names, batch log. |
| `_PROGRESS.md` | Human-readable run log of each 30-min batch. |
| `SCHEMA.md` | The entry contract + how it maps onto the game's strain schema. |

## How to promote an entry into the live game (manual, later)
1. Open `strains/<slug>.md`, review the `game_mapping:` YAML block.
2. Sanity-check trait bounds (see `SCHEMA.md`).
3. Paste the block as a new `- name:` entry into `src/growpodempire/data/strains.yaml`.
4. Run `python -m growpodempire.db.seed` (idempotent upsert by slug) + the test suite.

**Do not** auto-wire these into the game. Plant/sim work is in flux — promotion is a
deliberate, reviewed step.

## Sourcing
Each entry lists the sources it was built from (Leafly, SeedFinder, breeder pages,
etc.). Cannabinoid/terpene numbers vary by phenotype and lab; entries record typical
mid-ranges and flag estimates. Treat as game-design reference, not lab truth.
