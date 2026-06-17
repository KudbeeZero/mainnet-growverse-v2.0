# Cannabis Higher-Education Curriculum — Research Reference (2026-06-08)

> A research campaign into real cannabis degree programs, course catalogs, and curricula, to ground
> **GrowPod University** (`src/growpodempire/data/curriculum.yaml`). Sources are official
> university/college program pages, prioritized over secondary write-ups.

## 1. Credential tiers (real structure)
| Credential | Duration | Size | Example institutions |
|------------|----------|------|----------------------|
| Certificate | 6–52 wks | 100–400 contact hrs | Oaksterdam, Niagara College |
| Diploma / specialization | ~1 yr | ~5 courses | Durham College |
| **Associate (A.A.S./A.S.)** | 2 yrs | ~60 credits | Hocking College, City Colleges of Chicago |
| **Bachelor (B.S.)** | 4 yrs | 120 credits | **NMU Medicinal Plant Chemistry**, **CSU-Pueblo Cannabis Biology & Chemistry** |
| **Master (M.S.)** | 1–2 yrs | 30+ credits | CSU-Pueblo, CU School of Pharmacy |

The game maps these to escalating degree tiers (Certificate → Associate → Bachelor → Master → an
endgame Doctorate), with prerequisite chains (intro → 200 → 300/400).

## 2. Departments + real course names (the curriculum backbone)
- **Cultivation/Horticulture:** Penn State **PLANT 240 *Fundamentals of Cannabis*** (modules:
  propagation → outdoor → indoor → irrigation/nutrients → IPM → breeding → post-harvest); Oaksterdam
  *Commercial Horticulture*, *Horticulture Mastery*.
- **Plant Genetics & Breeding:** Cornell **Hemp Genetics**, **Hemp Breeding & Selection**, **Gene
  Editing & IP**; UC Davis *Hemp Breeding and Seed Production*; NMU *Plant Physiology*.
- **Soil & Nutrient Science:** Delaware Valley *plant nutrition / nutrient-solution formulation*;
  SUNY Orange *soil science, plant nutrition*; Penn State *Nutrient Management & Irrigation*.
- **Integrated Pest Management:** pest/disease ID (mites, aphids, thrips, powdery mildew, botrytis),
  scouting + action thresholds, prevention-first control hierarchy.
- **Cannabis Chemistry:** NMU **CH 420/421 *Medicinal Plant Chemistry I/II***, **CH 435 *Gas & Liquid
  Chromatography***; Thomas Jefferson *Botany & Chemistry*; CSU-Pueblo cannabinoid quantification.
- **Post-Harvest & Processing:** Cornell *post-extraction processing*; Green CulturED *Manicuring,
  Drying, Curing & Storing*; drying/curing/water-activity/storage.
- (Later) **Lab Analytics & QA** (Hocking College GC/HPLC), **Business/Law/Compliance** (Oaksterdam,
  multi-university compliance certs), **Pharmacology/Medical** (Cornell, CU Pharmacy).

## 3. What a course contains (seeds in-game lectures)
- **Intro cultivation:** plant biology, the grow cycle, environmental parameters, yield forecasting.
- **Genetics/breeding:** single-gene vs polygenic traits, Mendelian inheritance, G×E, selection
  schemes, stabilization.
- **Chemistry:** cannabinoid/terpene biosynthesis, chemotypes, GC/LC analytics, reading a CoA.
- **IPM:** ID + scouting + thresholds + biological/cultural/physical/chemical controls in priority.
- **Post-harvest:** harvest timing, controlled drying, the cure, water-activity/storage.

## 4. Prerequisite chains (real sequencing)
NMU B.S.: Gen Chem → Organic Chem → Medicinal Plant Chem; Biology parallel; capstone after junior
year. City Colleges of Chicago: Basic Cert → Advanced Cert → A.A.S. The game mirrors this with
`prereqs[]` and `level_req` per course, and degrees that require a set of completed courses.

## 5. Tone / persona
Rigorous, evidence-based, **practice-oriented** — grounded in botany/chemistry/pharmacology, not
recreational enthusiasm; emphasis on data, compliance, hands-on labs, scientific rigor. This frames
the in-game Professor (the Master Grower) — see `ai/lecturer_claude.py` system prompt.

## Sources (official program pages first)
- [NMU Medicinal Plant Chemistry](https://nmu.edu/chemistry/medicinal-plant-chemistry) · [catalog](https://catalog.nmu.edu/preview_program.php?catoid=4&poid=689)
- [CSU-Pueblo Cannabis Biology & Chemistry B.S.](https://www.csupueblo.edu/cannabis-biology-and-chemistry-bs/index.html) · [M.S.](https://www.csupueblo.edu/cannabis-biology-and-chemistry-ms/index.html)
- [CU School of Pharmacy — Cannabis Science and Medicine](https://pharmacy.cuanschutz.edu/academics/cannabis-science-and-medicine)
- [Penn State PLANT 240 syllabus](https://agsci.psu.edu/digital-education/academic/syllabi/plant-240)
- [Cornell eCornell — Hemp Genetics and Breeding](https://ecornell.cornell.edu/certificates/food-and-plant-science/hemp-genetics-and-breeding/) · [Medicinal Cannabis](https://ecornell.cornell.edu/certificates/food-and-plant-science/medicinal-cannabis/)
- [Niagara College — Commercial Cannabis Production](https://www.niagaracollege.ca/environment/program/cannabis-production/)
- [Durham College — Cannabis Industry Specialization](https://durhamcollege.ca/academic-faculties/professional-and-part-time-learning/programs-and-courses/programs/program?dept=DEDP&prog=CANB)
- [Hocking College — Cannabis Laboratory](https://www.hocking.edu/cannabis-laboratory)
- [City Colleges of Chicago — Cannabis Studies A.A.S.](https://catalog.ccc.edu/academic-program-requirements/cannabis-studies-aas/)
- [Oaksterdam University — Courses](https://oaksterdam.com/courses/) · [Certifications](https://oaksterdam.com/certification/)
- [UC Davis SBC — Hemp Breeding and Seed Production](https://sbc.ucdavis.edu/hemp-breeding-and-seed-production)
- [Thomas Jefferson University — Cannabis Science Certificate](https://www.jefferson.edu/academics/colleges-schools-institutes/health-professions/emerging-health-professions/academic-programs/certificates/cannabis-science.html)
- [Leafly — Best Cannabis College Degrees & Certifications](https://www.leafly.com/news/industry/best-cannabis-college-degrees-and-certifications)

*Generated 2026-06-08 by a deep-research agent; grounds `data/curriculum.yaml` and the Professor's
lecture framing.*
