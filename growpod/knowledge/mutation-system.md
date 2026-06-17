# Colour Mutation System

> Canonical colour-mutation chain + environmental unlocks. See `botanical-bible.md`.
> Status: **partial** — anthocyanin purple + per-strain palettes are implemented;
> the full mutation ladder and rarer phenotypes are planned.

## Mutation ladder
`Green → Lime → Deep Green → Purple → Black Purple → Pink Pistils → Albino`
- Each strain's `palette` (see `strain-dna.md`) places it on this ladder; cool
  nights push expression toward purple (see `environment-rules.md`).
- **Implemented:** green / lime / deep-green / purple / magenta / deep-purple as
  weighted palette colours; orange-vs-magenta pistils authored per strain.
- **Planned:** Black Purple (very dark anthocyanin), Pink Pistils as a distinct
  phenotype, Albino/White (rare), and rarity-gated mutation rolls.

## Environmental unlocks (target)
| Condition | Mutation |
|-----------|----------|
| Cool nights | Purple → deeper purple | ✅ (purple shift) |
| High UV | More resin/frost | ✅ (trichome density) |
| Light stress | Foxtails | ✅ (foxtailBias) |
| Drought | Smaller, darker calyxes | ✅ |
| High humidity | Mold risk (future visual) | 🔨 hidden score |

## Design intent
Mutations should be **rare and exciting** ("new seeds should be exciting") — a
deep-purple, pink-pistil, or albino expression is a memorable drop. Keep them
identity-preserving (a mutated G13 still reads as G13) and, where they're earned
by grow conditions, surfaced through the environment system rather than RNG alone.

## Implementation pointers
`web/src/lib/chamber/budDna.ts` (palette + `applyEnvironmentToBudDNA`),
`web/src/lib/chamber/strainVisuals.ts` (per-strain `BudColor`).
