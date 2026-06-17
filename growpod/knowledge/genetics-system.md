# Genetics System

> How the backend genome/breeding relates to the procedural bud visuals.
> See `botanical-bible.md`. The DB genome is authoritative; visuals are derived.

## Backend genome (authoritative)
- Catalog strains live in `src/growpodempire/data/strains.yaml` with canonical
  `traits` (indica_ratio, thc, cbd, flowering_time, yield, difficulty,
  disease/pest resistance, vigor) + a terpene set + `rarity`/`lineage_type`.
- The genome is built from those traits (`genetics/traits.py`,
  `genome_from_traits`), and display ranges are derived at seed time
  (`genetics/breeding.py`, `derive_strain_fields`).
- **Breeding** is generic and provably-fair: `cross(parentA, parentB, rng)` blends
  two genomes deterministically from a server-generated seed; offspring get a
  derived rarity. Any two catalog strains (incl. G13 / PDP / Animal Mints) can be
  crossed today — no per-strain work needed.
- Encyclopedia metadata (lineage, aroma, flavour, effects, cultivation) lives in
  `strain_knowledge.yaml`, 1:1 with the catalog (enforced by a test).

## Genome → visuals (current)
- `morphology.ts` derives plant/leaf morphology continuously from `indica_ratio`.
- Bud colour + `BudDNA` are **authored per strain** on the client today
  (`strainVisuals.ts`, `budDna.ts`), with a deterministic fallback derived from
  the strain's bud colour for non-curated strains.

## Direction (planned)
- Make a strain's **BudDNA derivable from its genome** (indica_ratio → cola
  width/rows; an anthocyanin/terpene-linked trait → palette; trichome trait →
  density) so **bred** offspring automatically render a believable, unique bud —
  the key to "new seeds are exciting." Until then, bred strains use the derived
  fallback DNA.
- Optional: promote the authored bud-colour/DNA layer from the frontend into the
  backend strain data so the DB stays the single source of truth.

## Implementation pointers
Backend: `src/growpodempire/genetics/`, `data/strains.yaml`, `data/strain_knowledge.yaml`.
Frontend: `web/src/lib/chamber/{morphology,budDna,strainVisuals}.ts`.
