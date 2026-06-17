# Strain entry schema + game mapping

Each `strains/<slug>.md` has **YAML frontmatter** (machine-readable) followed by
**prose** (history, effects, growing notes). The frontmatter is a superset of the
game's strain schema so entries stay rich *and* promotable.

## Frontmatter contract

```yaml
---
name: Gelato                      # display name
slug: gelato                      # kebab-case, unique, == filename
aka: [Gelato 42, Larry Bird]      # alternative names (optional)
type: hybrid-indica              # indica | sativa | hybrid | hybrid-indica | hybrid-sativa | ruderalis
lineage_type: hybrid             # GAME ENUM: landrace | hybrid | bred
parents: [Sunset Sherbet, Thin Mint GSC]
breeder: Cookie Family Genetics   # or "unknown"
origin: San Francisco, USA, 2014
rarity: rare                      # GAME ENUM: common | uncommon | rare | epic | legendary
# --- real-world chemistry (typical mid-ranges) ---
thc_pct: [20, 25]                 # [low, high]
cbd_pct: [0, 1]
indica_ratio: 0.55                # 0 = pure sativa, 1 = pure indica
flowering_days: [56, 63]          # indoor flower time
yield_indoor_g_m2: [400, 500]     # optional
difficulty: 3                     # 1 (easy) .. 5 (hard)
# --- terpenes ---
terpenes: [caryophyllene, limonene, humulene, myrcene]   # full real profile, dominant first
effects: [euphoric, relaxed, creative, happy]
flavors: [sweet, vanilla, citrus, berry]
aromas: [creamy, dessert, citrus]
awards: []                        # optional
# --- READY-TO-PASTE game mapping (subset that fits strains.yaml exactly) ---
game_mapping:
  name: Gelato
  lineage_type: hybrid            # landrace | hybrid | bred
  rarity: rare                    # common | uncommon | rare | epic | legendary
  stability: 0.8                  # 1.0 landrace; ~0.8 stable hybrid; lower if unstable
  terpenes: [caryophyllene, limonene]   # ONLY the 4 modeled genes, see note
  traits: {indica_ratio: 0.55, thc: 22, cbd: 0.5, flowering_time: 60, yield: 450, difficulty: 3, disease_resistance: 0.5, pest_resistance: 0.5, vigor: 0.7}
  dominant: [thc]                 # subset of trait keys that express dominant
sources:
  - https://www.leafly.com/strains/gelato
status: complete                  # complete | stub | needs-review
---
```

## Game schema bounds (validate before promotion)
- `lineage_type` ∈ {`landrace`, `hybrid`} for real-world strains (`bred` exists in the enum but is reserved for in-game player crosses — do not use it here)
- `rarity` ∈ {`common`, `uncommon`, `rare`, `epic`, `legendary`}
- `stability` 0..1  (landrace ≈ 1.0; modern polyhybrid ≈ 0.75–0.85)
- **`terpenes` (game)** — the engine models only **4 terpene genes:**
  `myrcene`, `limonene`, `caryophyllene`, `pinene`. List the strain's dominant
  ones from that set in `game_mapping.terpenes`. Keep the *full* real profile
  (humulene, linalool, terpinolene, ocimene, …) in the top-level `terpenes:` for
  reference — those just don't have a gene yet.
- `traits`: `indica_ratio` 0..1, `thc` 0..35, `cbd` 0..25, `flowering_time` 45..120,
  `yield` 50..800, `difficulty` 1..5, `disease_resistance`/`pest_resistance`/`vigor` 0..1
- `dominant`: any subset of the trait keys above.

## Mapping heuristics (real-world → game)
- `thc` / `cbd`: midpoint of the real range, clamped to bounds.
- `flowering_time`: midpoint of `flowering_days`.
- `yield`: midpoint of indoor g/m² if known, else infer from reputation (50–800).
- `difficulty`: use the real grow difficulty 1..5.
- `disease_resistance` / `pest_resistance` / `vigor`: estimate 0..1 from grow notes
  (hardy landraces high; finicky exotics lower). Flag as estimates in prose.
- `rarity`: landrace/exotic/award-winner → rare/epic/legendary; ubiquitous → common.
