# GrowPod University — Cannabis Science Curriculum (Research Reference, 2026-06-14)

> **Directive:** UNI-002 · **Lead:** UNI-A00 · **Worker:** UNI-A02
> **Status:** Research only — no code, no monetization, no token systems, no Phase 1 build.
> **Companion to:** `docs/research/2026-06-08-cannabis-education-curriculum.md` (real-world degree
> *structure* — credentials, departments, prereq chains) and `docs/memory/design/06-university.md`
> (the learning-system design). This document fills the gap between those two: the **science content
> itself** — every lesson a player should learn to graduate a knowledgeable virtual grower.
> Grounded in the in-game canon (`knowledge/botanical-bible.md`, `plant-anatomy-reference.md`,
> `environment-rules.md`, `genetics-system.md`) and mapped to the live course keys in
> `src/growpodempire/data/curriculum.yaml`.

---

## 0. Design philosophy — "the world's best cannabis education disguised as a game"

The mission test: **if GrowPod University were the planet's best cannabis-science platform wearing a
game costume, what should every player know by graduation?** Five principles shape the answer:

1. **Accurate before engaging — but engaging or it isn't taught.** Every claim must survive a real
   horticulturist's read (the Professor persona is "rigorous, evidence-based, practice-oriented"),
   yet every lesson must earn its screen time. No fact ships without a reason a player would care.
2. **Learn → prove → unlock.** The university's spine is already *study-time + a practical tied to
   live game state*. The curriculum is written so **every lesson has a grow-it-yourself proof.** You
   don't pass "Flowering Stages" by reading — you pass it by taking a plant through flower.
3. **Mistakes are the syllabus.** Beginners learn cannabis by killing plants. The curriculum
   front-loads the **failure modes** (overwatering, nute burn, light burn, early harvest) because
   recognizing a sick plant is the single most valuable beginner skill.
4. **Mental models over memorization.** Teach the *why* (transpiration, the source/sink relationship,
   Mendelian segregation) so a player can reason about a situation the game never explicitly scripted.
   This is what makes the knowledge transfer to the real world.
5. **Spiral, don't dump.** Each concept appears three times at increasing depth (Beginner =
   recognize, Intermediate = control, Advanced = optimize/explain). A player meets "nutrients" as
   "feed it" in week 1 and as "ion antagonism and Liebig's law" in the Master tier.

**Graduation promise:** a player who completes all three tiers can walk into a real grow room, read
the plants, diagnose a problem from symptoms, dial an environment by VPD/DLI, plan a breeding cross,
and harvest/cure at peak — *and explain why each choice is correct.*

---

## 1. The 19 research domains → teachable knowledge map

The directive's 19 topics, each distilled to its **core teachable truth** and its **in-game proof
hook**. This is the atomic content layer the three curricula are assembled from.

| # | Domain | Core teachable truth (the one thing they must not forget) | Proof hook |
|---|--------|-----------------------------------------------------------|-----------|
| 1 | **Plant anatomy** | Roots/stem/fan-vs-sugar leaves/nodes/calyx/pistil/trichome each do a job; trichomes are where cannabinoids live. | ID parts on your own plant render |
| 2 | **Germination** | A seed needs only moisture, warmth (~22–25 °C), and dark to pop a taproot; light/nutrients come *after*. | Germinate 1 seed |
| 3 | **Seedling care** | Seedlings want gentle light, high humidity, low nutrients; the #1 killer is overwatering/damping-off. | Keep a seedling alive to veg |
| 4 | **Vegetative growth** | Veg builds the *structure* that holds the harvest; 18/6 light, more N, training shapes the canopy. | Reach veg + top once |
| 5 | **Flowering stages** | Flip to 12/12 → stretch → bud set → fatten → ripen; flower is when yield/potency are made. | Take a plant through flower |
| 6 | **Photoperiod vs. autoflower** | Photoperiods flower on a *light signal* (12/12); autos flower on *age* regardless of light. | Grow one of each |
| 7 | **Nutrients & deficiencies** | N-P-K + Ca/Mg/S + micros; mobile vs. immobile deficiencies show *where* on the plant. | Diagnose 1 deficiency |
| 8 | **Watering** | Wet/dry cycles, not a schedule — roots need oxygen; water to ~10–20 % runoff, then let it dry back. | Avoid overwater for a cycle |
| 9 | **Lighting** | Plants eat *photons* (PPFD), measured over a day as **DLI**; spectrum and intensity both matter. | Hit a DLI target |
| 10 | **VPD & environmental control** | VPD (leaf-to-air moisture pressure) governs transpiration → nutrient uptake; it's the master canopy lever. | Hold VPD in range |
| 11 | **Temperature & humidity** | Day/night temp and RH set VPD and disease risk; ranges shift by stage. | Keep temp/RH in band |
| 12 | **Airflow & CO₂** | Moving air = strong stems + no mold; CO₂ only helps when light/temp are already maxed. | Run airflow a full grow |
| 13 | **Root health** | White roots = healthy; roots want oxygen, the right pH window, and no rot; the root zone is the engine. | Healthy root zone at harvest |
| 14 | **Pests & diseases** | Prevention > cure; ID the big ones (spider mites, thrips, aphids, powdery mildew, botrytis) early. | Survive/resolve 1 pest event |
| 15 | **Harvest timing** | Trichome color (clear→cloudy→amber) is the real ripeness clock, not the calendar. | Harvest at cloudy/amber |
| 16 | **Drying & curing** | Slow dry (~60/60 for ~7–14 d) then jar-cure weeks; this is where quality is *kept or lost*. | Complete a cure |
| 17 | **Breeding & genetics** | Phenotype = genotype × environment; Mendelian traits segregate; selection + stabilization make a line. | Make a cross / stabilize |
| 18 | **Common beginner mistakes** | The top killers: overwater, overfeed, light burn, pH neglect, early harvest, panic-fixing. | Avoid the classic Five |
| 19 | **Advanced cultivation** | Crop steering, training systems (SCROG/SOG/mainlining), defoliation, light/nute optimization, IPM programs. | Apply 1 advanced technique |

---

## 2. Lesson hierarchy (the four-level spine)

A strict containment hierarchy keeps content addressable and lets the game gate, search, and reward
at any granularity:

```
PROGRAM  (GrowPod University)
└── TIER            Beginner · Intermediate · Advanced  (maps to credential tiers)
    └── DEPARTMENT  Cultivation · Genetics · Nutrients · IPM · Chemistry · Post-Harvest
        └── MODULE  a themed unit ("The Grow Cycle", "Reading the Plant")  ≈ a course
            └── LESSON   one concept, one lecture, one practical proof  (the atom)
                └── BEAT  a single teaching point inside a lesson (quiz-able)
```

- **TIER** = the three deliverable curricula below; aligns with the real credential ladder
  (Certificate → Associate/Bachelor → Master, per the 2026-06-08 research) and the game's degree tiers.
- **DEPARTMENT** = the six already in `curriculum.yaml`. (Three more are planned in `06-university.md`:
  Lab Analytics & QA, Business/Law/Compliance, Pharmacology/Medical — **out of scope for this
  science curriculum**, noted so the hierarchy reserves their slots.)
- **MODULE ≈ COURSE** = the unit a player enrolls in; carries tuition (a sink), `duration_hours`, a
  prereq chain, and a degree contribution.
- **LESSON** = the atom: one mental model, delivered as a Professor lecture, proven by one practical.
  Every lesson below names its **proof** so the practical layer is never an afterthought.
- **BEAT** = the smallest unit; the natural home for the planned **knowledge quizzes**
  (`06-university.md` →"Where it's going").

---

## 3. DELIVERABLE 1 — Beginner Curriculum (Certificate tier)

**Goal:** keep a plant alive, take it seed-to-jar once, and recognize a sick plant. **Stance:** zero
assumed knowledge; failure-mode-first; one new idea per lesson. **Credential:** *GrowPod Certificate
in Cultivation* (maps to `cult-101` and friends; gates on `harvest_count >= 1`, then `cure`).

### B1 — Meet the Plant (Cultivation) → *the orientation module*
- **B1.1 Anatomy you can see** — roots, stem, fan vs. sugar leaves, node, cola, calyx, pistil, and
  the trichome (the frosty "where the good stuff lives"). *Proof: label your plant render.*
- **B1.2 The life cycle in one breath** — seed → seedling → veg → flower → harvest → dry/cure. The
  map every later lesson hangs on. *Proof: identify your plant's current stage.*
- **B1.3 What a plant eats** — light + water + air (CO₂) + a little food + the right root zone. The
  "five inputs" mental model. *Proof: name the five inputs.*

### B2 — Starting Life (Cultivation)
- **B2.1 Germination** — moisture + warmth (~22–25 °C) + dark → taproot. Paper-towel/soil methods;
  no nutrients yet. *Proof: germinate 1 seed.*
- **B2.2 Seedling care** — gentle light, humidity dome, barely-moist medium; **damping-off &
  overwatering are the seedling killers.** *Proof: seedling survives to veg.*
- **B2.3 Photoperiod vs. autoflower (intro)** — "does it flower on a clock you set, or on its own
  schedule?" Pick the right one for a first grow (autos forgive). *Proof: choose a seed type and say why.*

### B3 — Growing Up: Vegetative (Cultivation)
- **B3.1 What veg is for** — building the frame (roots, stems, leaves) that will *hold* the harvest.
  18/6 light, room to grow. *Proof: reach veg.*
- **B3.2 Watering without drowning** — the **wet/dry cycle**: water, then let it dry back; lift the
  pot to feel weight; roots need air. *Proof: complete a cycle without overwatering.*
- **B3.3 Feeding lightly** — start low; veg wants more nitrogen; "less is more" beats nute burn.
  *Proof: feed without burning tips.*

### B4 — Making Flowers (Cultivation)
- **B4.1 The flip** — photoperiods bud when nights get long (12/12); the **stretch** roughly doubles
  height. *Proof: flip a photoperiod (or watch an auto flip itself).*
- **B4.2 The flowering stages** — stretch → bud set → fatten → ripen; pistils and trichomes change as
  she matures. *Proof: take a plant through flower.*
- **B4.3 Smell, support, airflow** — buds get heavy and humid; airflow + support prevent mold and
  broken branches. *Proof: run a fan through flower.*

### B5 — Reading a Sick Plant (IPM + Nutrients, beginner)
- **B5.1 The classic deficiencies** — yellowing-from-the-bottom (N, mobile) vs. new-growth problems
  (Ca/Fe, immobile); **pH is the usual real cause.** *Proof: spot 1 deficiency.*
- **B5.2 The classic pests** — what spider mites, thrips, fungus gnats, and powdery mildew look like;
  catch them early. *Proof: identify 1 pest from a symptom card.*
- **B5.3 The Beginner's Five (mistakes)** — overwater, overfeed, light too close, ignore pH, harvest
  too early. The single most valuable beginner lesson. *Proof: finish a grow avoiding all five.*

### B6 — Bringing It Home (Post-Harvest)
- **B6.1 Harvest timing for beginners** — **look at the trichomes:** clear = early, cloudy = peak,
  amber = mellow. A loupe beats the calendar. *Proof: harvest at mostly-cloudy.*
- **B6.2 Dry & cure, the gentle way** — slow dry (~60 °F/60 % RH, ~7–14 days) then jar-cure with
  burps; **this is where quality is kept or thrown away.** *Proof: complete a cure.*
- **B6.3 You did it — now what** — sell / save seeds / replant; intro to the loop that the rest of
  the game runs on. *Proof: complete the core loop once.*

> **Beginner exit competency:** seed-to-jar once, zero plant deaths from the Five, can name every
> visible plant part and the current stage, and harvested by trichome color.

---

## 4. DELIVERABLE 2 — Intermediate Curriculum (Associate / Bachelor tier)

**Goal:** move from *keeping alive* to *controlling outcomes* — dial the environment, feed
deliberately, train the canopy, run a real IPM routine, and breed a first cross. **Stance:** introduce
measurement and the *why*; numbers and ranges now matter. **Credential:** *Associate/Bachelor in
Cultivation Science* (maps to `cult-201` VPD & DLI; gates climb to `harvest_quality >= 70`, then `breed`).

### I1 — Environmental Control (Cultivation) → *the flagship intermediate module*
- **I1.1 Temperature & humidity by stage** — the real target bands (warmer/humid for seedlings,
  cooler/drier into late flower) and why night temps matter. *Proof: hold temp/RH in band a full week.*
- **I1.2 VPD — the master lever** — vapor-pressure deficit ties temp+RH to **transpiration → nutrient
  uptake**; chart-reading and stage targets. *Proof: hold VPD in the stage window.*
- **I1.3 Airflow & transpiration** — boundary layer, stem strengthening, mold prevention; oscillation
  vs. canopy penetration. *Proof: maintain canopy airflow through flower.*

### I2 — Light as a Crop Input (Cultivation)
- **I2.1 PPFD & DLI** — plants count **photons**: PPFD (instantaneous) integrated over the day = DLI;
  stage targets (lower in veg, higher in flower). *Proof: hit a DLI target.*
- **I2.2 Spectrum & photoperiod control** — blue/red roles, the far-red/Emerson effect basics, why
  12/12 triggers flower and light leaks don't. *Proof: run a clean photoperiod with no leaks.*
- **I2.3 Light stress & distance** — light burn, bleaching, the inverse-square reality of hanging
  height. *Proof: avoid light burn while pushing intensity.*

### I3 — Plant Nutrition, Deliberately (Nutrients)
- **I3.1 The 17 essential elements** — macros (N-P-K), secondary (Ca-Mg-S), micros; mobile vs.
  immobile mapped to *where* symptoms appear. *Proof: correctly diagnose 2 deficiencies.*
- **I3.2 pH & the uptake window** — why pH 5.5–6.5 (hydro/soilless) vs. 6.0–7.0 (soil) gates every
  nutrient; **"it's usually a pH lockout, not a deficiency."** *Proof: correct a lockout.*
- **I3.3 EC/PPM & feeding strategy** — reading runoff, building a feed chart, the wet/dry-meets-feed
  rhythm; under- vs. over-feeding signatures. *Proof: run a feed chart to a clean harvest.*

### I4 — Shaping the Plant (Cultivation — training)
- **I4.1 Topping & FIMing** — apical dominance and how cutting it makes multiple colas. *Proof: top a
  plant and grow the result.*
- **I4.2 LST & defoliation** — low-stress training to spread the canopy; smart leaf removal for light
  and air (and how to *not* over-defoliate). *Proof: train a flat, even canopy.*
- **I4.3 Canopy management** — even canopy = even ripening; lollipopping the under-canopy. *Proof:
  even canopy into flower.*

### I5 — Integrated Pest Management (IPM)
- **I5.1 Prevention first** — sanitation, quarantine, screens, environment as the front line; **the
  IPM control hierarchy** (cultural → physical → biological → chemical, in that order). *Proof: run a
  prevention routine.*
- **I5.2 Scouting & action thresholds** — sticky traps, the loupe, *when* a population justifies
  action vs. monitoring. *Proof: scout and log a grow.*
- **I5.3 The major pests & diseases in depth** — spider mites, thrips, aphids, fungus gnats, broad/russet
  mites; powdery mildew, botrytis (bud rot), root rot — ID, lifecycle, response. *Proof: resolve a
  pest/disease event without crop loss.*

### I6 — Root Health & the Medium (Nutrients/Cultivation)
- **I6.1 The rhizosphere** — white healthy roots, oxygenation, soil vs. coco vs. hydro tradeoffs.
  *Proof: healthy root zone at harvest.*
- **I6.2 Root problems** — overwatering vs. root rot (pythium), how the canopy reports a root crisis.
  *Proof: diagnose and recover a root-zone problem.*

### I7 — Intro to Genetics & Breeding (Genetics)
- **I7.1 Genotype × Environment = Phenotype** — why the same seeds grow different plants; what
  "pheno-hunting" means. *Proof: observe phenotype variation across a pack.*
- **I7.2 Mendelian basics** — dominant/recessive, P/F1/F2, why a cross segregates; the cannabis
  examples (e.g. purple, sex). *Proof: make a first cross.*
- **I7.3 Reproductive biology & sexing** — male/female/hermaphrodite, pre-flowers, pollen handling,
  feminized vs. regular seed. *Proof: sex a plant correctly.*

> **Intermediate exit competency:** can hold an environment by VPD/DLI numbers, build and run a feed
> chart, train a canopy, run a scouting/IPM routine, and produce a deliberate F1 cross.

---

## 5. DELIVERABLE 3 — Advanced Curriculum (Master / Doctorate tier)

**Goal:** *optimize and explain.* Crop steering, the chemistry of potency/flavor, breeding a stable
line, and running a grow like a data-driven operation. **Stance:** mechanisms and tradeoffs; the
player should be able to *teach* this back. **Credential:** *Master of Cultivation Science* → endgame
*Doctorate* capstone (gates on `stabilize`, `cup_entry`, `harvest_quality` high, `research` depth).

### A1 — Crop Steering & Physiology (Cultivation)
- **A1.1 Source–sink & generative/vegetative steering** — steering with irrigation (dryback/EC), temp
  differential (day-night ΔT, "DIF"), and crop registration. *Proof: execute a steering plan.*
- **A1.2 Photosynthesis & the light/CO₂ ceiling** — light-response curves, when **CO₂ enrichment
  actually pays** (only after light/temp are maxed), light saturation per stage. *Proof: run an
  enriched/optimized environment.*
- **A1.3 Advanced training systems** — SCROG, SOG, mainlining/manifolding, high-stress training; pick
  the system for the goal. *Proof: complete a SCROG/SOG run.*

### A2 — Cannabis Chemistry (Chemistry)
- **A2.1 Cannabinoid biosynthesis** — CBGA → THCA/CBDA/CBCA via synthases; decarboxylation; why
  trichome maturity = potency. *Proof: harvest at targeted cannabinoid maturity.*
- **A2.2 Terpenes & the entourage** — the major terpenes (myrcene, limonene, caryophyllene, pinene,
  linalool…), how environment/genetics/cure shape the profile. *Proof: preserve a terpene profile
  through cure.*
- **A2.3 Chemotypes & reading a CoA** — Type I/II/III chemotypes, GC vs. LC, interpreting a
  Certificate of Analysis. *Proof: interpret a CoA correctly.*

### A3 — Advanced Breeding & Genetics (Genetics)
- **A3.1 Polygenic traits, heritability & G×E** — most traits aren't single-gene; selection under
  heritability and environment. *Proof: select on a quantitative trait.*
- **A3.2 Selection schemes & stabilization** — backcrossing (BX), inbred lines (IBL/S1), recurrent
  selection, fixing a trait. *Proof: stabilize a line.*
- **A3.3 Advanced techniques** — feminization (the science), making clones/mother management,
  polyploidy & tissue-culture *concepts*, preservation. *Proof: maintain a true-breeding line.*

### A4 — Advanced Plant Health & Diagnostics (IPM/Nutrients)
- **A4.1 Integrated programs & biologicals** — beneficial insects, predatory mites, microbial
  inoculants, rotation to avoid resistance. *Proof: run a biological IPM program.*
- **A4.2 Differential diagnosis** — deficiency vs. toxicity vs. pH vs. pathogen vs. environment:
  reasoning from a symptom set to a cause. *Proof: solve a multi-cause diagnostic case.*
- **A4.3 Nutrient mastery** — Liebig's law of the minimum, ion antagonism (e.g. Ca/Mg/K), tissue
  testing, custom solution formulation. *Proof: formulate and run a custom feed.*

### A5 — Harvest, Post-Harvest & Quality Science (Post-Harvest)
- **A5.1 Ripeness as a decision** — trichome heads vs. stalks under magnification, pistil cues, the
  potency-vs-yield tradeoff of an extra week. *Proof: harvest at a defended ripeness target.*
- **A5.2 Drying & curing science** — water activity (aw), the chemistry of the cure (chlorophyll
  degradation, terpene retention), environment control, storage longevity. *Proof: hit a target aw /
  premium cure.*
- **A5.3 Quality grading** — bag appeal, nose, burn, the variables that move a Cup score. *Proof:
  enter and place in a Cup.*

### A6 — The Grower as Scientist (capstone — cross-department, Doctorate)
- **A6.1 Data-driven cultivation** — logging, controlled single-variable changes, reading your own
  grow data, continuous improvement. *Proof: ship a documented A/B improvement.*
- **A6.2 Systems thinking** — how light, VPD, nutrition, genetics, and steering interact; debugging an
  underperforming room holistically. *Proof: diagnose+fix a whole-room underperformance.*
- **A6.3 Capstone** — design, grow, breed, harvest, and *document* a project end-to-end. *Proof: the
  doctoral capstone — a high-quality harvest from a stabilized line, defended.*

> **Advanced exit competency:** can steer a crop, explain potency/flavor from biosynthesis to cure,
> stabilize a genetic line, diagnose from first principles, and run a grow as a documented experiment.

---

## 6. DELIVERABLE 4 — Lesson hierarchy (consolidated)

See §2 for the structural definition. The full **content tree** assembled from §§3–5:

```
GrowPod University
├── BEGINNER  (Certificate)
│   ├── B1 Meet the Plant            B2 Starting Life
│   ├── B3 Vegetative                B4 Making Flowers
│   └── B5 Reading a Sick Plant      B6 Bringing It Home
├── INTERMEDIATE  (Associate/Bachelor)
│   ├── I1 Environmental Control     I2 Light as a Crop Input
│   ├── I3 Plant Nutrition           I4 Shaping the Plant
│   ├── I5 IPM                       I6 Root Health
│   └── I7 Genetics & Breeding (intro)
└── ADVANCED  (Master/Doctorate)
    ├── A1 Crop Steering & Physiology   A2 Cannabis Chemistry
    ├── A3 Advanced Breeding            A4 Advanced Plant Health
    ├── A5 Post-Harvest Science         A6 The Grower as Scientist (capstone)
```

**Coverage check — all 19 directive domains land:** anatomy→B1.1/A2.1; germination→B2.1; seedling→B2.2;
veg→B3; flowering→B4; photoperiod/auto→B2.3/I2.2; nutrients/deficiencies→B5.1/I3/A4.3; watering→B3.2;
lighting→I2/A1.2; VPD/environment→I1; temp/humidity→I1.1; airflow/CO₂→I1.3/A1.2; root health→I6;
pests/diseases→B5.2/I5/A4; harvest timing→B6.1/A5.1; drying/curing→B6.2/A5.2; breeding/genetics→I7/A3;
beginner mistakes→B5.3; advanced concepts→A1/A3/A4/A6. ✔ 19/19.

---

## 7. DELIVERABLE 5 — Suggested module order

**Two valid orderings; the game should default to A and unlock B for confident players.**

**Order A — Grow-Along (recommended default).** Sequence lessons to a player's *own* first grow so
the curriculum and the gameplay advance together (this is what makes the practicals feel natural, not
like homework):

1. B1 (orientation) → **plant a seed**
2. B2 → seedling alive
3. B3 → veg + first water/feed lessons *as they happen*
4. B4 → flip + flower
5. B5 *interleaved through B3–B4* (deficiencies/pests taught the moment a plant can show them)
6. B6 → harvest + cure → **Certificate**
7. *Second grow* unlocks Intermediate: I1→I2→I3 (control the inputs), I4 (train), I5→I6 (protect),
   I7 (breed) → **Associate/Bachelor**
8. *Operation tier* unlocks Advanced: A1→A2 (steer + chemistry), A3 (stabilize), A4 (diagnose), A5
   (quality), A6 capstone → **Master → Doctorate**

**Order B — Academic (catalog) order.** For players who want to *study ahead*: department-by-department
top to bottom (Cultivation → Nutrients → IPM → Genetics → Chemistry → Post-Harvest), each climbing
101→201→301. Mirrors the real prereq chains in the 2026-06-08 research and the `prereqs[]` graph in
`curriculum.yaml`.

**Hard prerequisites (must hold in either order):**
`B1 → everything`; `B2 → B3 → B4 → B6`; `I1 (VPD/temp/RH) → I2/I3` (environment before fine inputs);
`I3 → A4.3`; `I7 → A3`; `A2 → A5.2`; `A6 capstone → requires all Advanced modules`.

**Pacing:** beginner lessons should clear in a single grow's real-time; intermediate/advanced lessons
intentionally span multiple grows (the "growing doesn't happen overnight" ethos — study time + a
practical that *needs* a finished grow to satisfy).

---

## 8. DELIVERABLE 6 — Real-world educational references

**Tier 1 — Accredited programs (verified, reused from the 2026-06-08 degree-structure research; use
these to ground course names, sequencing, and the Professor's rigor):**
- [NMU — Medicinal Plant Chemistry B.S.](https://nmu.edu/chemistry/medicinal-plant-chemistry) ·
  [catalog](https://catalog.nmu.edu/preview_program.php?catoid=4&poid=689)
- [CSU-Pueblo — Cannabis Biology & Chemistry B.S./M.S.](https://www.csupueblo.edu/cannabis-biology-and-chemistry-bs/index.html)
- [Penn State — PLANT 240 *Fundamentals of Cannabis*](https://agsci.psu.edu/digital-education/academic/syllabi/plant-240) (the closest real analog to this science curriculum's cultivation spine)
- [Cornell eCornell — Hemp Genetics & Breeding](https://ecornell.cornell.edu/certificates/food-and-plant-science/hemp-genetics-and-breeding/)
- [Oaksterdam University — Courses](https://oaksterdam.com/courses/) (Horticulture / Commercial Horticulture)
- [UC Davis — Hemp Breeding & Seed Production](https://sbc.ucdavis.edu/hemp-breeding-and-seed-production)
- [Hocking College — Cannabis Lab](https://www.hocking.edu/cannabis-laboratory) ·
  [City Colleges of Chicago — Cannabis Studies A.A.S.](https://catalog.ccc.edu/academic-program-requirements/cannabis-studies-aas/)

**Tier 2 — Authoritative scientific & horticultural sources (for content accuracy):**
- **Bruce Bugbee / Apogee Instruments / Utah State CEA** — the standard real research on PPFD, DLI,
  light spectrum, and CO₂ in controlled environments (grounds I2 and A1.2).
- **VPD charts (cannabis CEA standard)** — the canonical leaf-temp-offset VPD targets by stage
  (grounds I1.2).
- **Karl Hillig; Robert C. Clarke & Mark D. Merlin, *Cannabis: Evolution and Ethnobiology*** —
  taxonomy and population genetics (grounds I7/A3).
- **Cannabinoid biosynthesis literature** (CBGA → THCA/CBDA/CBCA synthases; Taura et al.; ElSohly &
  Slade reviews) — grounds A2.1.
- Peer-reviewed venues to cite by name: *Frontiers in Plant Science* (cannabis cultivation/lighting),
  *Journal of Cannabis Research*, *Botany* — for the "evidence-based" persona.

**Tier 3 — Canonical practitioner references (beginner-friendly, widely trusted — for tone & how-to):**
- **Ed Rosenthal, *Marijuana Grower's Handbook*** — the standard cultivation manual.
- **Jorge Cervantes, *The Cannabis Encyclopedia* / *Marijuana Horticulture*** — encyclopedic grow
  reference.
- **Robert Connell Clarke, *Marijuana Botany*** — classic on botany & breeding.
- **DeNeve / "Greengenes" / university extension fact sheets** — deficiency & IPM symptom guides.

**Internal canon (must not contradict):** `knowledge/botanical-bible.md`,
`knowledge/plant-anatomy-reference.md`, `knowledge/environment-rules.md`,
`knowledge/genetics-system.md`, `knowledge/grow-tent-rules.md`, and the live
`src/growpodempire/data/curriculum.yaml`. **Rule:** where real-world science and in-game simulation
differ (the sim is a simplification), teach the real science but **flag the in-game model** so a
player isn't misled about what the simulation rewards.

---

## 9. DELIVERABLE 7 — Recommendations for GrowPod University implementation

> Recommendations only — **no build in this directive.** These hand the Records Department and the
> build track a clear path that fits the *existing* university system (`06-university.md`,
> `university_service.py`, `curriculum.yaml`) rather than inventing a parallel one.

1. **Reuse the shipped spine; this curriculum is *content*, not a new system.** The
   enroll→study-time→practical→degree machinery already exists and honors the economy invariants
   (tuition = sink, perks ≠ GROW faucet). Drop these lessons in as `curriculum.yaml` course/lecture
   data; do **not** build new mechanics.
2. **Author every lesson with its practical already attached.** §§3–5 name a *Proof* for each lesson;
   they map onto the existing practical types (`harvest_count`, `harvest_quality`, `breed`,
   `stabilize`, `cure`, `cup_entry`, `research`, `level`). A few advanced lessons (VPD-hold, DLI-hit,
   pest-resolve, deficiency-diagnose, root-health) imply **new practical types** — flag these as a
   *future* practical-engine ask, not a blocker; until then, approximate with the nearest existing type.
3. **Make "Reading a Sick Plant" (B5) the hero module.** Symptom→cause is the highest-value, most
   game-able content. Recommend a **diagnostic mini-mechanic** (symptom card → pick the cause) as the
   richest fit for the planned knowledge-quiz layer — but propose it as a Phase-2 design, not now.
4. **Default to Grow-Along ordering (§7 Order A).** Lessons should surface *when the player's plant
   reaches the relevant moment* (a flowering plant unlocks B4's lecture). This is the single biggest
   "education disguised as a game" lever and needs only lesson↔stage tags, no new system.
5. **Spiral the spine across tiers (anatomy/nutrients/genetics/harvest each appear 3×).** Keep
   beginner lessons recognition-level and push mechanism into Advanced; reuse the same Department so
   transcripts read coherently.
6. **Give the Professor lesson-level grounding.** Each lecture should be authorable with citations to
   §8 references so `ClaudeLecturerProvider` lectures (and the deterministic mock) stay accurate and
   on-persona. Recommend a per-lesson `references[]` field in the lecture data.
7. **Author knowledge quizzes at the BEAT level (§2).** The hierarchy already isolates beats; quizzes
   slot in deterministically-graded per `06-university.md`'s roadmap. Keep them *formative* (teach,
   don't punish) for beginners; *gating* only at Master+.
8. **Reserve the three planned departments** (Lab Analytics & QA, Business/Law/Compliance,
   Pharmacology/Medical) in the hierarchy but **leave them out of this science curriculum** — they're
   a separate directive and out of UNI-002 scope.
9. **Truth-in-simulation guardrail.** Where the sim simplifies reality, the lecture must teach real
   science *and* note the in-game model — otherwise the university undermines its own accuracy promise
   (and the "DB-authoritative sim is a simplification" reality). Recommend a `sim_note` field.
10. **Submit to Records (UNI-A10) as the *content layer* of the Master Bible**, sitting beside the
    2026-06-08 *structure* research — together they're the complete university blueprint: structure +
    science.

---

## 10. Think Big — the graduation guarantee

If GrowPod University is the world's best cannabis-science platform wearing a game costume, **every
graduate can:**

- **Read a plant on sight** — name every visible part, the current stage, and whether she's healthy.
- **Diagnose from symptoms** — distinguish deficiency vs. toxicity vs. pH lockout vs. pest vs.
  environment, and act in the right control order.
- **Dial an environment by the numbers** — target VPD, DLI/PPFD, temp/RH, airflow, and CO₂ by stage,
  and explain *why* each lever moves yield or potency.
- **Feed deliberately** — the 17 elements, the pH uptake window, EC/runoff, and Liebig's law.
- **Steer a crop** — generative/vegetative steering, training systems, and the source–sink logic
  behind them.
- **Plan and execute genetics** — phenotype = genotype × environment, Mendelian segregation,
  selection, and stabilizing a line.
- **Harvest and cure at peak** — read trichomes, hit a water-activity target, and protect the terpene
  profile.
- **Explain the chemistry** — cannabinoid/terpene biosynthesis from CBGA to the cured jar, and read a
  CoA.
- **Think like a scientist** — log, change one variable, read the data, improve — and *teach it back.*

That last clause is the bar: **a GrowPod graduate could keep a real plant alive, bring it to a quality
harvest, and explain every decision.** Education, disguised as a game, that actually transfers.

---

## 11. UNI-005 canonical framework reconciliation (Lead consolidation, 2026-06-14)

> Directive **UNI-005** (Lead UNI-A00, Science Curriculum Research Division UNI-A01–A10) consolidated
> this research and **promoted a canonical academic framework** that refines the working structure in
> §§1–10: a 19-domain canon, an 8-tier thematic degree ladder, and an 8-faculty organization. This
> section integrates that canon so the documentation matches the consolidated record (closing the
> "Memory: ✅ Integrated" claim). It **refines, not replaces** §§1–10 — the three curricula, lesson
> hierarchy, ordering, references, and recommendations all stand; this is the official top-level
> taxonomy they hang under. **Research only — still no code.**

### 11.1 Canonical 19 science domains (supersedes the §1 working list)
The §1 map was framed around the original UNI-002 topic list; the UNI-005 canon below is the official
naming. The two are the same body of science — §1's coverage check still holds (all teaching content
maps), but **cite these names going forward**:

| # | Canonical domain | Where it's taught (§§3–5) | Faculty (§11.3) |
|---|------------------|---------------------------|-----------------|
| 1 | Cannabis Botany | B1.1, B1.2, I7.1 | Plant Sciences |
| 2 | Plant Anatomy & Morphology | B1.1, A2.1 | Plant Sciences |
| 3 | Plant Physiology | B3.1, I1.2, A1.1–A1.2 | Plant Sciences |
| 4 | Genetics & Heredity | I7.1–I7.2, A3.1 | Genetics & Breeding |
| 5 | Breeding & Phenohunting | I7.2, A3.1–A3.3 | Genetics & Breeding |
| 6 | Chemotypes & Cannabinoids | A2.1, A2.3 | Chemistry |
| 7 | Terpenes & Aromatic Science | A2.2, A5.2 | Chemistry |
| 8 | Plant Nutrition | B3.3, I3, A4.3 | Cultivation Sciences |
| 9 | Soil Science | I3.2, I6.1 | Cultivation Sciences |
| 10 | Hydroponics & Soilless Systems | I6.1 | Cultivation Sciences |
| 11 | Environmental Science | I1.1, I1.3, A1.2 | Cultivation Sciences |
| 12 | Lighting Science (PPFD, DLI, VPD) | I1.2, I2, A1.2 | Cultivation Sciences |
| 13 | Irrigation Science | B3.2, I3.3, A1.1 | Cultivation Sciences |
| 14 | Integrated Pest Management | B5.2, I5, A4.1 | Plant Health |
| 15 | Plant Pathology | I5.3, A4.2 | Plant Health |
| 16 | Harvest Science | B6.1, A5.1 | Post-Harvest Sciences |
| 17 | Drying & Curing Science | B6.2, A5.2 | Post-Harvest Sciences |
| 18 | Analytical & Laboratory Methods | A2.3, A6.1 | Research & Methods |
| 19 | Cannabis Industry, Regulation & Ethics | *(new track — §11.4)* | Industry & Ethics |

**Scope change vs. §§3–5:** the working curriculum deferred Lab Analytics, Business/Law/Compliance,
and Pharmacology/Medical as "out of scope." UNI-005 **promotes two of those into the science canon** —
**Analytical & Laboratory Methods** (domain 18) and **Cannabis Industry, Regulation & Ethics**
(domain 19) — as the Research & Methods and Industry & Ethics faculties. They become first-class, not
deferred. (Pharmacology/Medical remains a separate future directive.)

### 11.2 Canonical degree ladder (8 thematic tiers) ↔ credential tiers
UNI-005 sets the player-facing progression as a thematic 8-tier ladder. It maps onto the real
credential tiers from the 2026-06-08 structure research and the §§3–5 curricula:

| Thematic tier (UNI-005) | Credential analog | Curriculum tier (§§3–5) | Unlocks |
|-------------------------|-------------------|--------------------------|---------|
| **Seedling** | Orientation | B1 (Meet the Plant) | Anatomy, life cycle, the five inputs |
| **Grower** | Certificate | B2–B6 | Seed-to-jar; the Beginner's Five |
| **Cultivator** | Associate | I1–I6 | Environment by numbers; feed; train; IPM |
| **Breeder** | Bachelor | I7 + A3 | Genetics, crosses, stabilization |
| **Researcher** | Master (coursework) | A1–A2, A4 | Steering, chemistry, diagnostics |
| **Professor** | Master (teaching) | A2.3, A5, quizzes | Reads CoAs; can teach it back |
| **Master Grower** | Master (capstone) | A5, A6.1–A6.2 | Quality science; data-driven cultivation |
| **Doctorate** | Doctorate | A6.3 capstone | Documented end-to-end project, defended |

Each tier progressively unlocks deeper domains, lab methods, and research requirements — consistent
with the prereq chains in §7 and `curriculum.yaml`'s `prereqs[]`/`level_req`.

### 11.3 Canonical 8-faculty organization ↔ the 6 shipped departments
UNI-005's faculties refine `curriculum.yaml`'s six departments. Crosswalk:

| Faculty (UNI-005) | Covers domains | `curriculum.yaml` department | Status |
|-------------------|----------------|------------------------------|--------|
| 🌱 **Plant Sciences** | Botany, Morphology, Physiology (1–3) | `cultivation` (split out) | refine existing |
| 🧬 **Genetics & Breeding** | Genetics, Breeding, Phenohunting, **Mutations** (4–5) | `genetics` | refine existing |
| 🧪 **Chemistry** | Cannabinoids, Terpenes, Chemotypes (6–7) | `chemistry` | existing |
| 🌎 **Cultivation Sciences** | Nutrition, Soil, Hydroponics, Environment, Lighting, Irrigation (8–13) | `cultivation` + `nutrients` | merge/refine |
| 🦠 **Plant Health** | IPM, Pathology (14–15) | `ipm` | refine (split pathology) |
| 🏆 **Post-Harvest Sciences** | Harvest, Drying, Curing (16–17) | `postharvest` | existing |
| 🔬 **Research & Methods** | Analytics, Lab Methods, Research Design (18) | *(planned: Lab Analytics & QA)* | **promoted** |
| ⚖️ **Industry & Ethics** | Regulation, Ethics, Industry Systems (19) | *(planned: Business/Law/Compliance)* | **promoted** |

Note: the **Mutations** sub-track under Genetics & Breeding links the curriculum to existing canon in
`knowledge/mutation-system.md` and `knowledge/genetics-system.md` — a clean tie-in for the breeding
faculty.

### 11.4 New canonical tracks to author (domains 18–19, previously deferred)
Because UNI-005 promotes these into the canon, the build track should plan lessons for them (content
sketch only — no code):

- **🔬 Research & Methods (Researcher+ tiers):** sampling & representative testing; GC vs. HPLC and
  what each measures; reading/auditing a CoA (extends A2.3); experimental design, single-variable
  testing, and data logging (extends A6.1); basic statistics for grow data. *Proofs:* `research`
  depth, documented A/B (reuse A6.1's hook).
- **⚖️ Industry, Regulation & Ethics (Professor+ tiers):** seed-to-sale tracking & compliance
  concepts; testing/labeling standards; responsible-use and harm-reduction ethics; sustainability
  (energy/water footprint of indoor grows). *Proofs:* knowledge-quiz/`level` gates (no real-money or
  chain mechanics — honors the economy invariants).

### 11.5 What stands unchanged
The three curricula (§§3–5), the lesson hierarchy (§§2, 6), module ordering (§7), references (§8), and
implementation recommendations (§9) are all consistent with this canon and **require no rework** —
UNI-005 is a taxonomy promotion layered on top, not a redesign. The §9 recommendations (reuse the
shipped spine, attach a proof to every lesson, Grow-Along default, spiral the tiers, lesson-level
Professor grounding, beat-level quizzes, truth-in-simulation guardrail) apply unchanged to the
expanded 8-faculty / 19-domain canon.

---

*Prepared by Worker Agent UNI-A02 under Lead UNI-A00 — Directive **UNI-002**, reconciled to the
**UNI-005** consolidation (2026-06-14). Research only — no code, monetization, or token systems.
Held by Records Dept (UNI-A10) as the science-content layer of the GrowPod University Master Bible,
beside the 2026-06-08 degree-structure research.*
