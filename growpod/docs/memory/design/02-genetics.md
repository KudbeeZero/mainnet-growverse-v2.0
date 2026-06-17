# 🧬 Genetics — endless, generative, ownable

> The deep design for genetics: from today's solid 14-trait inheritance model toward an effectively
> **unbounded** genome where players *create and discover* cultivars that become provable, ownable
> on-chain assets. Tags: ✅ built · 🔨 partial · ⬜ planned. This is moat #2/#3/#4/#5 in
> `00-game-vision.md`. "The possibilities are endless" is the design requirement, not a slogan.

## Where genetics is today ✅
A genuine quantitative-genetics core already exists (`src/growpodempire/genetics/`):

- **Genome = a dict of traits**, each `{value, dominance}` where dominance ∈
  `dominant | recessive | codominant` (`genetics/traits.py`). **14 traits:** `indica_ratio, thc,
  cbd, flowering_time, yield, difficulty, disease_resistance, pest_resistance, vigor` + 4 terpenes
  (`myrcene, limonene, caryophyllene, pinene`).
- **Crossbreeding** (`cross()`, `genetics/breeding.py`): per trait, a **dominance-weighted blend**
  (0.75/0.25 when one parent dominates, else mean) + **Gaussian segregation noise** scaled by
  instability, then dominance is re-inherited probabilistically. **Seeded & deterministic** — same
  `rng_seed` → identical offspring.
- **Stability & stabilization** (`services/game_service.py`): selfing raises stability
  (`stabilize_increment: 0.15`, `balance.yaml:43`); stable lines breed true (tight phenotype bands),
  unstable lines are a roll of the dice. **Stability narrows the displayed min/max ranges**
  (`derive_strain_fields()`).
- **Rarity climb** (`assign_rarity()`): extreme traits (high THC/yield) + high stability push
  offspring up the rarity ladder; fresh crosses usually drop a tier.
- **Provenance already persisted:** `Strain` rows store `genome` (JSON), `stability`, `generation`,
  `parent_a_id/parent_b_id`, `created_by_player_id`; `BreedingEvent.rng_seed` is saved for replay
  (`db/models.py`). **This is the seed of Proof-of-Cultivation** — the seed is already on record.
- **22 founder strains** seeded from `src/growpodempire/data/strains.yaml` (the original 16 + 6
  iconic landraces/classics), each with a scientist-grade encyclopedia entry in
  `data/strain_knowledge.yaml` (lineage, origin, cannabinoid/terpene detail, cultivation params),
  surfaced at `GET /strains/<id>/knowledge`. A test enforces 1:1 catalog↔KB sync. The KB is grounded
  by a peer-reviewed research reference
  (`docs/research/2026-06-08-cannabis-strain-genetics-and-cultivation.md`) whose load-bearing finding
  reinforces this doc's thesis: **strain names are unreliable genetic/chemotype identifiers**
  (Sawler 2015; Schwabe 2019) — so the *genome + verifiable lineage* must be the authoritative
  identity, and `indica_ratio` is morphology/lore, not a chemotype predictor.

This is a strong base. It is also **bounded**: a fixed 14-trait vector, blend-and-jitter
inheritance, no novelty. The vision is to make the space *open*.

---

## Toward endless possibility ⬜
The goal: a strain space so large that cultivars are **discovered, not enumerated**, and two serious
breeders almost never converge on the same line. Five moves, each layering onto the existing `cross()`:

1. **Polygenic genome.** Back each expressed trait with **many loci** (alleles) rather than one
   value. THC becomes the sum/interaction of N small-effect genes → a smooth, high-dimensional space
   and realistic bell-curve segregation. The 14 "traits" become *expressed phenotypes* computed from
   a much larger genotype.
2. **Mutation & novel alleles.** Rare seeded mutation events introduce alleles **not present in
   either parent** — the engine of genuine novelty. Frequency is a `balance.yaml` knob; rarity makes
   a lucky mutation a real event. This is what lets players "create anything."
3. **Epistasis (gene × gene).** Some loci *modulate* others (a gene that gates THC expression, a
   trade-off coupling high THC to lower vigor). Turns a flat vector into an interacting network with
   emergent phenotypes breeders learn to chase.
4. **G × E (genotype × environment).** The *same* genome grown under different agronomy expresses
   differently (`01-simulation-horticulture.md`). A master grower can coax a phenotype the genome
   only *permits*. This couples genetics ↔ simulation and rewards skill — and makes
   Proof-of-Cultivation meaningful (the conditions matter, not just the cross).
5. **Landrace expeditions / gene discovery.** A sink-gated way to introduce **new wild genes** into
   the pool (expeditions, events), keeping the space expanding over the game's life — fuel for the
   discovery economy below.

**Hard rule — determinism survives all of this.** Every mutation, segregation, and discovery draw
stays **seeded and audited** (extend the `BreedingEvent.rng_seed` pattern). "Random" must remain
*reproducible* — it's what makes outcomes cheat-proof and Proof-of-Cultivation possible. (Anti-goal
in `00-game-vision.md`.)

---

## Provenance as moat 🔨→⬜
The endgame isn't a strain — it's a **verifiable genetic ledger.**
- **Verifiable pedigree (✅ shipped).** `GET /strains/<id>/lineage`
  (`services/game_service.py:verify_lineage`) walks a strain's whole ancestry back to base-catalog
  roots, replaying every bred node from its persisted seed — the provable family tree *data* behind
  the GenBank, no chain required. `tests/test_provenance.py` covers it.
- **Genome fingerprint (⬜).** Hash the canonical genome → a stable, unique id for a cultivar.
- **On-chain pedigree graph (⬜).** Mint stabilized cultivars with their parent edges; the chain
  mirrors the DB's lineage (`parent_a_id/parent_b_id`). DB stays authoritative (ARCHITECTURE) — the
  chain *proves*, it doesn't *govern*.
- **The GenBank.** The union of all minted cultivars + pedigree edges = a shared, player-owned seed
  bank with network effects. It compounds; it can't be cloned by a fresh competitor.
- **Proof-of-Cultivation.** Bundle `{breeding seed, parent fingerprints, agronomic conditions}` into
  the NFT so the asset *proves how it came to exist*. Already half-built: the seed is persisted.
- **Visual:** the pedigree graph is **exactly** what the genetic-constellation aesthetic renders —
  see `00-game-vision.md` §Signature visual language (`assets/genetic-constellation-reference.jpeg`).

> Minting gates exist today (`mint_min_rarity: rare`, `strain_min_stability: 0.85`,
> `balance.yaml:314`) but the chain is **mocked** — no funded TestNet/IPFS yet (`DECISIONS.md`,
> BACKLOG Sprint 4). The GenBank is ⬜ until that lands.

---

## Discovery economy ⬜
Generative genetics makes phenotypes genuinely *findable*, so reward finding them:
- **First-discoverer credit + naming rights**, recorded on-chain (like describing a new species).
- **Genetic prospecting** as a meta — chase a rare allele/phenotype combination nobody has surfaced.
- Ties to mastery (`03-grower-skills.md`): a master breeder's verified findings carry market value.
A pre-authored strain list *cannot* offer this; an open genome is what makes it possible.

---

## Integration — what to wire next
- **Make the sim consume more genes (🔨→⬜).** Today only `flowering_time`, `disease_resistance`,
  `pest_resistance` reach the engine (`engine.py`). `vigor → health recovery`, `difficulty →
  uptake/tolerance widths`, `indica_ratio → VPD/humidity tolerance & morphology` should become real
  sim inputs — the bridge that makes G × E gameplay.
- **Deepen NFT metadata.** Extend ARC-3 metadata from trait ranges toward genome fingerprint +
  pedigree pointer + Proof-of-Cultivation bundle (`chain/metadata.py`).
- **Keep `balance.yaml` the dial.** Mutation rate, epistasis strength, expedition costs, discovery
  rewards are all data, not code (mirror the existing `breeding:` / `seeds:` sections).

## Cross-links
- The grow that expresses the genome: `01-simulation-horticulture.md` (G × E).
- The mastery that gates great breeding: `03-grower-skills.md`.
- The look of the pedigree/GenBank: `00-game-vision.md` §Signature visual language.
