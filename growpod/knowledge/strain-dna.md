# Strain DNA

> Canonical `BudDNA` model + authored presets. See `botanical-bible.md`.
> Implementation: `web/src/lib/chamber/budDna.ts`.

## BudDNA fields
**Genetic (define the strain's base look):**
- `budHeight`, `maxBudWidth` — the cola's aspect; `maxBudWidth/budHeight` is the
  chunky-indica ↔ slim-sativa axis. (Abstract units, scaled to the canvas.)
- `rows`, `calyxPerRowMin`, `calyxPerRowMax` — density of the stack.
- `calyxSizeMin`, `calyxSizeMax` — calyx size range.
- `overlap` (0.6–0.75) — how tightly calyxes stack.
- `pistilChance`, `sugarLeafChance` — per-calyx spawn rates.
- `trichomeDensity` — frost amount.
- `palette` — weighted calyx colours (`{hue,sat,lit,weight}`), composed from named
  colours (green/lime/deepGreen/purple/magenta/deepPurple).

**Environmental (added by `applyEnvironmentToBudDNA`, default absent):**
`foxtailBias`, `topStretch`, `highlightBoost`, `moldRisk` — see `environment-rules.md`.

## Authored presets (current)
| Strain | budH | maxW | rows | calyxSize | overlap | trich | palette |
|--------|------|------|------|-----------|---------|-------|---------|
| **G13** | 170 | 75 | 18 | 7–14 | 0.68 | 0.70 | green / lime / deepGreen |
| **Purple Diddy Punch** | 150 | 95 | 16 | 8–16 | 0.72 | 0.85 | purple / magenta / deepPurple |
| **Animal Mints** | 160 | 85 | 17 | 7–15 | 0.70 | 0.95 | green / lime / purple / deepPurple |

Matches the Bible: G13 slim green medium-frost; PDP chunky purple; Animal Mints
mixed green/purple extremely frosty. **Open tune (Bible §4):** Animal Mints'
"golf-ball stacking" — bias toward rounder, larger calyxes — not yet dialed.

## Derivation for non-curated strains
`budDnaFor(slug, budColor)` returns the authored preset for a known slug, else a
default DNA whose palette is derived from the strain's `budColor` (green base +
optional purple accent / anthocyanin). `pickPaletteColor` is empty-palette safe.

## Rules
- Keys are the backend slug (`slugify(name)`), so DNA lines up with the catalog.
- Editing a strain's look = editing its preset numbers, never hand-placing shapes.
