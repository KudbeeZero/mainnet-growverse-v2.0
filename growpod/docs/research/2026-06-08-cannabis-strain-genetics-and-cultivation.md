# Cannabis Strain Genetics & Cultivation — Research Reference (2026-06-08)

> A deep-research campaign to verify and deepen the GROWv2 strain knowledge base
> (`src/growpodempire/data/strain_knowledge.yaml`). Method: 5 parallel research agents (lineage,
> chemotype, cultivation, agronomy, taxonomy/genetics), peer-reviewed sources prioritized over
> breeder/lab-aggregate, with adversarial confidence rating and explicit flagging of weak claims.
> **Confidence legend:** **High** = replicated peer-reviewed · **Med** = single study or convergent
> mixed sources · **Low** = sparse/vendor/lore. Numbers are reference ranges, **not** the game's
> per-plant simulation outputs.

## TL;DR — the eight load-bearing findings
1. **Strain names are weak chemotype/genotype identifiers.** Sawler 2015: in 35% of same-name
   comparisons, samples were *more* similar to differently-named samples; reported indica/sativa
   ancestry explains only ~36% of genetic variation (r²=0.36). **High.**
2. **Same-named strains are genetically inconsistent.** Schwabe & McGlaughlin 2019: **27 of 30
   strains (90%)** contained ≥1 genetic outlier despite clonal propagation. **High.**
3. **The vernacular "indica/sativa" axis is botanically inverted and a poor predictor.** McPartland &
   Guy 2017: marketplace "Sativa" ≈ botanical *C. indica*; marketplace "Indica" ≈ *C. afghanica*.
   The labels don't reliably map to genetics, chemistry, or effects. **High.**
4. **Hundreds of names collapse into ~3 terpene chemotypes:** myrcene-dominant, terpinolene-dominant,
   and limonene/caryophyllene. Two independent large studies converge. **High.**
5. **Dispensary THC labels are inflated ~15–35%.** Schwabe 2023: measured mean **14.98%** vs labeled
   **20.3–24.1%**; ~57% of samples were >30% below label. Plus "lab shopping" — THC varies
   *systematically by testing lab* (Jikomes & Zoorob 2018, n=175,136). **High.**
6. **Light is the best-grounded yield lever.** Flower yield rises ~**linearly with canopy PPFD to
   ≥1500–1800 µmol·m⁻²·s⁻¹** — far above leaf-level photosynthetic saturation (~1500). Eaves 2020;
   Rodriguez-Morrison 2021. **High.**
7. **VPD/RH stage targets are vendor-derived, not peer-validated.** The physiology is sound; the
   specific kPa/% breakpoints have no controlled-cannabis trial behind them. **Low–Med.** (Late-flower
   RH <50% for botrytis suppression is the best-justified RH claim.)
8. **Clone-era "official" lineages are breeder lore.** OG Kush, Chemdawg, Sour Diesel, Bubba Kush,
   GG4 have **no genetically verified parents**; treat reported crosses as canonical *lore*, not
   ground truth. **High** (that they're unverified).

---

## 1. Taxonomy & the name-reliability problem (the meta-finding)
The single most important scientific result for a game built on strain *names* + an `indica_ratio`
trait: **names and the indica/sativa axis are marketing, not reliable science.**

- **Botanical reality (McPartland & Guy 2017; McPartland 2018):** all drug cannabis is *C. sativa*
  L.; the vernacular labels are inverted relative to the scientific names (a 1970s misidentification).
  **High.**
- **Ancestry ≠ genetics (Sawler 2015, 14,031 SNPs):** reported sativa ancestry r²=0.36 with PC1; a
  "100% sativa" Lambs Bread was nearly identical (IBS 0.98) to a "100% indica" Afghani; hemp is
  genetically *closer* to indica-type (Fst 0.136) than sativa-type (0.161) — opposite the folk
  assumption. **High.**
- **Categories have no genetic signature (Schwabe 2019/2021):** Fst among Sativa/Hybrid/Indica labels
  0.023–0.039 (negligible; hemp-vs-drug = 0.394); STRUCTURE's K=2 groups did **not** match the labels.
  **High.**
- **Chemotype is the modern, defensible frame (Reimann-Philipp 2020, Nevada n=2,662):** 396 names →
  3 terpene chemovars; the 12 genetic clades did **not** correlate with the 3 chemotypes (genotype
  and chemotype roughly independent). **High.**

**Design implication:** in GROWv2 the *genome/seed lineage* (the genetics layer + `verify_lineage`)
should be the authoritative identity; the *name* is a loose phenotype-cluster label. `indica_ratio`
is best read as a **morphology/lore axis (broad-leaf↔narrow-leaf)**, not a predictor of effect or
chemistry — drive real mechanics off chemotype (THC:CBD + terpene cluster). THC-label inflation and
"lab shopping" are a ready-made, true-to-life trust/quality subsystem.

## 2. Lineage & origin
Three tiers (Sawler 2015 is the reason the third tier exists):

| Tier | Strains | Notes |
|------|---------|-------|
| **Verifiable landraces** (geography solid, no "cross") | Afghani, Hindu Kush, Durban Poison, Thai, Acapulco Gold | "Afghani" is a regional *type*, not one cultivar. Modern "Acapulco Gold" seed is often a re-creation. **Med–High.** |
| **Landrace-derived (not pristine)** | Maui Wowie | Hawaiian sativa later crossed with Afghani/Thai; commonly mislabeled "pure landrace." **Med.** |
| **Well-documented breeder hybrids** | Skunk #1 ((Afghani×Colombian Gold)×Acapulco Gold), Original Haze (Colombian×Mexican×Thai×S.Indian), Northern Lights (Afghani sel. #5), AK-47 (Col×Mex×Thai×Afghani; exact pedigree secret), Jack Herer (Haze×(NL5×Shiva Skunk)), White Widow (Brazilian×S.Indian; creator disputed), Super Lemon Haze (Lemon Skunk×SSH) | Breeder-attested; still not marker-verified. **High on inputs.** |
| **Clone-era / disputed (lore, NOT verified)** | **OG Kush** (bag seed ~1990s FL→LA; "Chemdawg×Hindu Kush" unconfirmed), **Chemdawg** (1991 Deer Creek concert seeds; parents unknown), **Sour Diesel** (Chemdawg-91 × ? — DNL vs Mass Super Skunk), **Bubba Kush** (OG × unknown New Orleans indica), **GG4** (accidental: Chem's Sister×Sour Dubb×Chocolate Diesel) | Treat reported parents as canonical lore. **Low** confidence in the crosses. |
| **Modern hybrids (breeder uncertain)** | Blue Dream (Blueberry×SSH; no single breeder), Granddaddy Purple (Purple Urkle×Big Bud, two accounts), GSC (OG Kush×F1 Durban, proprietary), Pineapple Express (Trainwreck×Hawaiian, commercial) | Cross widely cited, details proprietary/contested. **Med.** |

## 3. Chemotype (cannabinoids + terpenes)
**The three peer-reviewed terpene super-clusters** (Reimann-Philipp 2020; Smith/Vergara 2022) — the
robust signal beneath all marketing "genres":
- **Myrcene-dominant** (~59% of samples; the "OG/indica" default): myrcene, limonene, pinene,
  caryophyllene, humulene.
- **Terpinolene-dominant** (rarest, *most diagnostic* — when present the name is unusually
  trustworthy; also higher CBG, median ~0.98% vs ~0.65%): terpinolene, γ-terpinene, myrcene, pinene.
- **Limonene/caryophyllene** (dessert/gas): limonene, caryophyllene, nerolidol.

**Per-strain terpene cluster + THC** (THC = lab-aggregate, *inflation-biased upward*; real flower
typically mid-teens to low-20s after the ~−35% correction):

| Strain | Dominant terpenes | Cluster | THC~ (label) | Conf |
|--------|-------------------|---------|--------------|------|
| Durban Poison | terpinolene > myrcene, ocimene | **Terpinolene** | 17–25% | **High** |
| Jack Herer | terpinolene, caryophyllene, pinene | **Terpinolene** | 16–22% | **High** |
| Haze / Super Lemon Haze | terpinolene/limonene, pinene, caryophyllene | Terpinolene→citrus | 17–23% | Med |
| Thai | terpinolene, limonene, myrcene | Terpinolene | 15–22% | Low |
| OG Kush, Sour Diesel, Chemdawg, GG4 | caryophyllene/myrcene/limonene | OG/Gas | 18–28% | Med |
| GSC | caryophyllene, limonene, linalool/humulene | Dessert | 19–25% | Med |
| Blue Dream | myrcene, pinene, caryophyllene | Sweets/Dreams | 17–24% | Med |
| Afghani, Hindu Kush, Northern Lights, Skunk #1, White Widow, GDP, Bubba Kush, AK-47 | myrcene > caryophyllene (±limonene/pinene) | **Myrcene** | 15–25% | Med |
| Pineapple Express | caryophyllene, limonene, ocimene | Tropical/Floral | 18–24% | Med |
| Acapulco Gold, Maui Wowie | myrcene/pinene | uncertain | 17–24% | Low |

**Minor cannabinoids:** CBD <1% in essentially all of these (96.5% of US commercial flower is
THC-dominant). CBG elevated in the terpinolene cluster. CBN = a *degradation* marker (aging), not
genetics. THCV not meaningfully present in any of these (it's an African/SE-Asian-landrace trait).
**Within-name variance is large** — phenotype, grow, harvest timing and cure all shift terpene
ratios; model a name as a *prior over a cluster*, not a fixed chemotype.

## 4. Cultivation parameters
All flowering/yield figures are **breeder claims — best-case**, not typical home-grow results.

- **Flowering time tracks sativa-ness:** Afghan/indica 6.5–9 wk · balanced hybrids 8–10 wk · sativa
  landraces 11–20 wk (Thai up to 20; Original Haze 12–14).
- **Mold/bud-rot risk tracks bud *density*, not lineage:** dense indica colas (OG Kush, GDP, GG4,
  Bubba, Chemdawg, Afghani, Hindu Kush, GSC) need flower RH ~40–50% + airflow; airy sativas (Thai,
  Haze, Durban) resist rot but bring height/length/climate problems. OG Kush also = powdery-mildew
  prone.
- **Difficulty is bimodal:** *Easy/robust* — Northern Lights, White Widow, Blue Dream, AK-47, Skunk
  #1, Afghani, Hindu Kush, Bubba Kush. *Hard* — Haze, Thai, Acapulco Gold (long-flower sativa
  landraces: time/climate), Chemdawg & GSC (sensitivity/mold).
- **Photoperiod vs auto:** every canonical strain is originally **photoperiod**; "auto" versions are
  ruderalis crosses (derivatives) with reduced yield/potency — not the canonical genetics.

## 5. Agronomy science (evidence-based environmental optima)
| Parameter | Target (by stage) | Evidence | Conf |
|-----------|-------------------|----------|------|
| **PPFD (flower)** | yield ~linear to **1500–1800** µmol·m⁻²·s⁻¹; leaf saturates ~1500 but *canopy* does not | Eaves 2020; Rodriguez-Morrison 2021 (peer-reviewed) | **High** |
| **DLI** | veg ~20–40; flower ~35–50 mol·m⁻²·d⁻¹ | USU/Bugbee (whole-plant) + vendor | Med–High |
| **Temperature** | photosynthetic optimum **25–30 °C**; cooler 20–24 °C late flower for quality/mold | Chandra 2008/2011 (leaf-level, peer-reviewed) | High (physiology) |
| **CO₂** | ambient ~400; enriched ~1000–1200 (≈95% of gain by 1200 ppm; ~+40% yield), benefit ~DLI-independent | Chandra (leaf) + USU (whole-plant) | Med–High |
| **VPD** | clones 0.4–0.8 · veg/early-flower 0.8–1.2 · mid/late flower 1.2–1.6 kPa | **Vendor charts only** (Aroya/Pulse) — physiology sound, breakpoints unvalidated | **Low–Med** |
| **RH** | seedling 65–80 · veg 55–70 · early flower 50–60 · late flower **<50** (botrytis) | Vendor + pathology rationale | Low–Med (late-flower <50 best-justified) |

**Reconciliation with GROWv2's sim (Phase A):** the engine's `simulation.vpd.optimal: [0.8, 1.6]`
and `simulation.light.optimal_ppfd: [300, 900]` / DLI readout are **consistent with the
vendor-tier consensus** and sit in defensible territory — but tag VPD/RH as *lower-confidence* tuning
knobs in `balance.yaml`. The strongest future lever (Phase B) is making **flower yield scale with
PPFD/DLI** up to ~1500–1800 (with a CO₂ multiplier), which is the best-evidenced relationship in the
field.

## 6. Implications for GROWv2 (action items)
- **Honesty in the KB (do now):** the strain `lineage` fields for the disputed five (OG Kush,
  Chemdawg, Sour Diesel, Bubba Kush, GG4) and Maui Wowie should read as *disputed lore*, not fact —
  and the KB header should state the name/chemotype/THC caveats. (Done in this change.)
- **Chemotype enrichment (next pass):** add a `terpene_cluster` (myrcene / terpinolene /
  limonene-caryophyllene) to each KB entry — the terpinolene cluster is the high-confidence one.
- **THC realism (sim/genetics):** model assayed THC as a distribution centered mid-teens–low-20s with
  per-grower/per-phenotype noise; a "lab-shopping"/label-inflation + compliance-band mechanic is a
  realistic trust/quality sink (ties to the trust layer).
- **`indica_ratio`:** keep as morphology/lore (broad↔narrow leaf), decoupled from effect claims.
- **Light as the yield lever (Phase B):** make flower yield scale with PPFD/DLI to ~1500–1800 +
  a CO₂ multiplier — the best-evidenced agronomy in the literature.
- **Diversity-collapse mechanic:** naive hybridization erodes distinctiveness (Sawler/Schwabe) —
  reward deliberate diversity preservation; punish homogenization. Aligns with the generative-genetics
  vision (`docs/memory/design/02-genetics.md`).

---

## Sources (peer-reviewed first)
**Genetics / taxonomy / chemovar:**
- Sawler et al. 2015, *The Genetic Structure of Marijuana and Hemp*, PLoS ONE 10(8):e0133292 — https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0133292 · https://pmc.ncbi.nlm.nih.gov/articles/PMC4550350/
- Schwabe & McGlaughlin 2019, *Genetic tools weed out misconceptions of strain reliability*, J. Cannabis Research 1:3 — https://link.springer.com/article/10.1186/s42238-019-0001-1
- Schwabe et al. 2021, *Comparative Genetic Structure of Cannabis sativa*, Front. Plant Sci. 12:675770 — https://www.frontiersin.org/journals/plant-science/articles/10.3389/fpls.2021.675770/full · https://pmc.ncbi.nlm.nih.gov/articles/PMC8476804/
- Schwabe et al. 2023, *Uncomfortably high: inflated THC potency on retail labels*, PLoS ONE 18(4):e0282396 — https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0282396 · https://pmc.ncbi.nlm.nih.gov/articles/PMC10096267/
- McPartland & Guy 2017, *Models of Cannabis Taxonomy…*, The Botanical Review 83:327–381 — https://link.springer.com/article/10.1007/s12229-017-9187-0
- McPartland 2018, *Cannabis Systematics…*, Cannabis and Cannabinoid Research — https://journals.sagepub.com/doi/10.1089/can.2018.0039
- Reimann-Philipp et al. 2020, *Cannabis Chemovar Nomenclature Misrepresents… Diversity* (Nevada, n=2,662), Cannabis Cannabinoid Res. 5(3):215–230 — https://pmc.ncbi.nlm.nih.gov/articles/PMC7480732/
- Smith/Vergara et al. 2022, *Phytochemical diversity of commercial Cannabis in the US*, PLoS ONE — https://pmc.ncbi.nlm.nih.gov/articles/PMC9119530/
- Hazekamp et al. 2016, *Cannabis: From Cultivar to Chemovar II*, Cannabis Cannabinoid Res. — https://www.liebertpub.com/doi/full/10.1089/can.2016.0017
- Jikomes & Zoorob 2018, *Cannabinoid content varies systematically across testing facilities* (WA, n=175,136), Sci. Reports — https://www.nature.com/articles/s41598-018-22755-2
- *Reported-THC discontinuity around the 20% threshold* — https://pmc.ncbi.nlm.nih.gov/articles/PMC7958443/

**Agronomy / CEA:**
- Rodriguez-Morrison, Llewellyn & Zheng 2021, *Cannabis Yield, Potency, and Leaf Photosynthesis Respond Differently to Increasing Light*, Front. Plant Sci. — https://pmc.ncbi.nlm.nih.gov/articles/PMC8144505/ · https://www.frontiersin.org/journals/plant-science/articles/10.3389/fpls.2021.646020/full
- Eaves et al. 2020, *Light intensity, cannabis yields, and profitability*, Agronomy Journal — https://acsess.onlinelibrary.wiley.com/doi/10.1002/agj2.20008
- Rodriguez-Morrison et al. 2022, *Indoor cannabis yield increased proportionally with light intensity*, Front. Plant Sci. — https://www.frontiersin.org/journals/plant-science/articles/10.3389/fpls.2022.974018/full
- Chandra et al. 2008, *Photosynthetic response of Cannabis sativa to PPFD, temperature, CO₂*, Physiol. Mol. Biol. Plants — https://pmc.ncbi.nlm.nih.gov/articles/PMC3550641/
- Chandra et al. 2011, *Temperature response of photosynthesis in drug/fiber Cannabis varieties* — https://pmc.ncbi.nlm.nih.gov/articles/PMC3550580/
- Responses of Medical Cannabis to Daily Light Integrals (Utah State / Bugbee lab dissertation) — https://digitalcommons.usu.edu/cgi/viewcontent.cgi?article=1379&context=etd2023

**Lineage & breeder/lab-aggregate (label as non-peer-reviewed):** Sensi Seeds, Serious Seeds, Green
House Seeds, Royal Queen Seeds, DNA Genetics, Dutch Passion, Blimburn, ILGM, Leafly, SC Labs
PhytoFacts, SeedFinder, Strainpedia, Alchimia, CannaGenie, Carters Cannabis, Wikipedia — used for
breeder-attested crosses, grow parameters, and terpene-genre mapping; treated as optimistic/lore and
subordinate to the peer-reviewed findings above.

*Generated 2026-06-08 by a 5-agent deep-research campaign. Grounds a follow-up enrichment pass of
`src/growpodempire/data/strain_knowledge.yaml`.*
