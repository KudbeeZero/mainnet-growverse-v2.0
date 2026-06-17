# 🎓 GrowPod University — Master Bible (Canonical)

> ## ❄️ FROZEN — UNI-011 Canonical Freeze & Implementation Hold (2026-06-14)
> **GrowPod University development is PARKED until after MVP launch.** This file is the **single
> authoritative source of truth** for all University systems (degrees, academic/Methods tracks,
> curriculum, research pathways, Professor, quizzes, social/credential systems, and all future
> University directives). Until the **University Build Phase** is explicitly authorized by the owner:
> **no code / renderer / economy / `curriculum.yaml` changes, no new University systems, no PRs**
> unless explicitly requested. Records/documentation only. Methods-track `curriculum.yaml`
> integration is **owner-gated** and activates only in the University Build Phase. Any future chat:
> read this file first before proposing or starting University work.

> **Records Department · maintained by UNI-A10 (Records Consolidation).** The single canonical
> reference for GrowPod University's *curriculum knowledge* — what the university teaches and how.
> It **consolidates and indexes** the underlying research deliverables; it does not replace them.
> When detail is needed, follow the links to the source docs. **Institutional knowledge — research
> only. No code, no feature implementation, no monetization/token design.**
>
> GrowPod University is built on **two interlocking tracks**:
> 1. **Academic Curriculum** — degrees, lectures, theory (the *what*). Grounds the shipped degree
>    tree in real cannabis higher-ed.
> 2. **Methods Track** — habits, drills, diagnosis, instincts (the *how*). Teaches players to *think
>    like growers*, not just memorize facts.
>
> Design canon for the shipped mechanics lives in `docs/memory/design/06-university.md`; the
> player-facing data lives in `src/growpodempire/data/curriculum.yaml`. This Bible is the
> records-side consolidation that sits above both.

---

## Directive Index

| Directive | Title | Worker | Classification | Status | Implementation | Owner Gate |
|-----------|-------|--------|----------------|--------|----------------|-----------|
| **UNI-003** | Master Grower Methods | UNI-A03 | Research Only | ✅ COMPLETE | **Deferred** | Required for future `curriculum.yaml` additions |
| **UNI-010** | Master Bible Update – Practical Curriculum Integration | UNI-A10 | Records Only | ✅ COMPLETE | n/a | — |
| **UNI-004** | Master Bible Consolidation (canonical source of truth) | UNI-A01–A10 | Records Only | ✅ COMPLETE | n/a | — |
| **UNI-011** | Canonical Freeze & Implementation Hold | UNI-A00 | Records Only | ✅ COMPLETE / ❄️ FROZEN | **Parked → University Build Phase** | Owner approval to lift freeze |

> **Canonical path (UNI-004):** this file — `docs/research/university/GROWPOD_UNIVERSITY_MASTER_BIBLE.md`
> — is the authoritative source of truth. All future University directives reference it **first**
> before creating courses, degrees, Methods modules, quizzes, academic progression, the Professor
> system, research mechanics, or credential systems.

> **Prior grounding research** (predates directive numbering, folded into the Academic track):
> *Cannabis Higher-Education Curriculum* (2026-06-08) and *Cannabis Strain Genetics & Cultivation*
> (2026-06-08).

**Maintenance rule:** every new Research-Department directive that touches the university is logged in
this table and woven into the sections below. Status values: `AUTHORIZED → IN PROGRESS → COMPLETE`;
Implementation: `Deferred → In Development → Shipped`. Implementation changes that alter player-facing
curriculum (e.g., new `curriculum.yaml` tracks) are **owner-gated** per the delegation charter.

---

## 1. Academic Curriculum (theory / degrees)

*The "what." Source: `docs/research/2026-06-08-cannabis-education-curriculum.md` ·
shipped model: `docs/memory/design/06-university.md`.*

GrowPod University's academic spine mirrors **real cannabis higher-ed** — credential tiers and course
names drawn from NMU Medicinal Plant Chemistry, CSU-Pueblo Cannabis Biology & Chemistry, Cornell hemp
genetics/breeding, Penn State PLANT 240, and Oaksterdam.

- **Credential ladder:** Certificate → Associate → Bachelor → Master → (endgame Doctorate), with real
  prerequisite chains (`prereqs[]`, `level_req`) and degrees requiring sets of completed courses.
- **Departments (6 shipped):** Cultivation & Horticulture · Plant Genetics & Breeding · Soil &
  Nutrient Science · Integrated Pest Management · Cannabis Chemistry · Post-Harvest & Processing.
  Planned: Lab Analytics & QA · Business/Law/Compliance · Pharmacology/Medical.
- **A course =** a `lecture` (topic + objectives), a `practical` tied to live gameplay, `credits`,
  `duration_hours`, `tuition`, `prereqs`, `level_req`, and `perks`.
- **How a course is earned:** pay tuition (a GROW *sink*) → let `duration_hours` of study time elapse
  → **meet a practical against real game state**. A degree's `required_courses` unlock permanent perks
  (same effect keys as the research tree), a permanent title, and XP.
- **The AI Professor:** a CI-safe lecturer (`ai/lecturer_claude.py`, mock when no key) delivers
  real-looking, science-grounded lectures.
- **Economy invariant:** tuition is a sink; degrees pay perks/XP, **not GROW** → net-deflationary.

**Tone:** rigorous, evidence-based, practice-oriented botany/chemistry/pharmacology — not recreational
enthusiasm.

---

## 2. Methods Track (experiential companion to the Academic Curriculum)

*The "how." Source: `docs/research/2026-06-14-master-grower-methods.md` (UNI-003).*

Where the Academic Curriculum teaches *facts*, the **Methods Track teaches players to think like
growers** — the habits, instincts, and mistake-correction loops that separate a beginner from a
master. It is **practice-first**: the plant is the textbook.

**Core thesis — how master growers actually teach:**
1. **The plant is the textbook** — read the plant before the biochemistry.
2. **Less is more** — most beginner failures are *over*-care (water/nutrient/fiddling).
3. **One change at a time** — diagnosis is impossible if you alter many variables.
4. **Keep a journal** — memory lies; the log converts "grew a plant" into "learned to grow."
5. **Boring is good** — a stable, flat-lined environment beats heroics.
6. **Reps compound** — mastery is gated by *completed cycles*, not hours read.

**The three roadmaps** (each with a graduation *instinct* and an in-game practical gate):

| Track | Goal | Graduation instinct | In-game gate |
|-------|------|---------------------|--------------|
| **Beginner** | Keep one plant alive; finish the full seed→harvest→cure cycle, and know *why* it lived | "I water by pot weight, not a calendar, and I can tell thirsty from drowning" | `harvest_count ≥ 1`, `cure ≥ 1` |
| **Intermediate** | Grow on purpose; dial environment; diagnose & fix mid-grow; steer quality | "I feed to the plant's response, catch a deficiency by *which* leaves, and harvest by trichomes" | `harvest_quality ≥ 70–85`, `cure ≥ 3` |
| **Advanced** | Express the genetics; breed/stabilize; finish to competition grade; teach | "I find the keeper in a pack, stabilize what I like, and finish so the cure does the genetics justice" | `breed`, `stabilize ≥ 1`, `harvest_quality ≥ 85+`, `cup_entry ≥ 1` |

> The Methods Track and Academic Curriculum are designed to **interlock**: each course can pair a
> **lecture** (theory) with a **practical drill** (instinct).

---

## 3. Practical Drills

*Observation- and decision-driven drills that build the reflexes; map onto live game state. Detail in
UNI-003 §10.*

1. **Lift-to-water** — water by weight/feel, never by date → anti-over-watering reflex.
2. **Half-dose start** — begin nutrients at ½ strength; ramp to appetite → "less is more."
3. **Spot-the-droop** — thirst droop vs. over-water droop, opposite fixes → the #1 beginner distinction.
4. **Deficiency-by-location** — *old vs. new leaf? tip vs. interveinal?* + check pH first → mobility diagnosis.
5. **One-change discipline** — reward changing one variable and waiting → variable isolation, patience.
6. **Trichome call** — pick the harvest window from trichome state + state the trade-off.
7. **The cure hold** — reward patience through a slow dry + multi-week cure → highest-ROI upgrade.
8. **Daily walk-through** — the *observe → measure → minimal action → log* loop each in-game day.
9. **Pheno-hunt & cull** *(advanced)* — score a population, keep one, justify the cull → selection discipline.
10. **Stabilize a line** *(advanced)* — cross toward a goal trait over generations → breeding intent.
11. **Journal-and-predict** — predict the meter from the plant *before* reading it → the master skill.

---

## 4. Grower Habits

*The daily ritual is itself the skill — it forces observation and catches problems while small.
Detail in UNI-003 §3.*

**Daily walk-through:** 1) **Observe before you touch** (posture, color, new growth). 2) **Check the
environment numbers** (temp/RH→VPD, light) and confirm they're *stable*. 3) **Assess water by weight**;
water only if needed; check runoff pH/EC when feeding. 4) **Scout for pests/disease** (leaf undersides,
new growth, soil surface). 5) **Inspect for deficiency by location** (old vs. new growth). 6) **Light
training/maintenance** — gently and sparingly; most days this is nothing. 7) **Log everything** +
a daily photo. 8) **Stage-specific check** — trichomes/pistils in flower; watch humidity hard in late
flower.

> The habit loop *is* the curriculum: **observe → measure → minimal action → record.**

---

## 5. Plant Diagnostics (observation & plant-reading)

*What most separates experts from beginners; the hardest thing to teach from theory. Detail in
UNI-003 §4 & §6.*

**Posture / turgor:** *praying* (happy) · *thirst droop* (limp, light pot — recovers fast) ·
*over-water droop* (curled/clawed, **firm**, heavy wet pot — opposite fix; **the #1 beginner confusion**)
· *taco/canoe* (heat/light stress) · *clawing* (N toxicity / overfeed).

**Deficiency by location (the diagnostic key):**
- **Mobile → old/lower leaves first:** N (uniform fade), Mg (interveinal, lower), K (burnt margins),
  P (dark/purpling).
- **Immobile → new/upper growth first:** Ca (new-growth distortion), S (uniform new-leaf pale),
  Fe (bright interveinal on the *newest* leaves).
- **Burnt tips/margins = excess**, not deficiency. **Always suspect pH lockout before "add more."**

**Flowering & ripeness:** pistils are a *rough* guide; **trichomes are the verdict** (clear=early,
cloudy/milky=peak, amber=more sedative/degraded). Late-flower leaf fade is normal.

**Smell** is a real instrument: green→terpene aroma→ammonia/hay = bad/rushed cure or rot.

> Master skill: **predict what the meter will say from the plant, then verify.**

---

## 6. Troubleshooting Frameworks

*Beginners treat symptoms; experts find the upstream cause. Detail in UNI-003 §5–§8.*

**Order of operations:** 1) **Environment first, plant second** — most "deficiencies" are
environment/root-zone (heat, over-water, pH, EC). 2) **Root-zone levers:** moisture · oxygen · pH ·
EC/salt. 3) **Climate levers:** temp · RH→VPD · airflow · light · CO₂, stage-appropriate (veg
warm/humid; flower cool/drier; late flower drier to fight mold). 4) **Isolate with one change**, then
wait a full observation period. 5) **Severity triage:** mold/rot/pests/heat → act now; slow lower-leaf
fade in late flower → often normal, log & watch.

**Nutrient rule of thumb:** feed the plant not the schedule; start low (½-strength); pH is the
gatekeeper (soil ~6.2–6.8, coco/hydro ~5.5–6.2); EC = *how much*, pH = *whether it's available*;
when in doubt, plain water.

**Diagnostic flow:** `Symptom → Where? (old vs new, tip vs interveinal) → check pH/EC + environment
first → suspect lockout before lack → change ONE thing → wait & observe → log.`

**Harvest & cure (where quality is won or lost):** harvest by **trichomes** as a deliberate trade-off;
**dry slow and cool**, then **cure in jars with burping** for weeks. The biggest beginner upgrade isn't
a better light — it's *not rushing the dry and cure.*

**The beginner→expert instinct ladder** (UNI-003 §9) is the canonical rubric for "feels like a real
grower": water by feel · feed to appetite · find the upstream cause · change one thing · read the
plant · harvest by trichomes · respect the cure · journal & predict · stay calm · breed with intent.

---

## 7. Recommended Future Implementations

*Design recommendations for when GrowPod University enters active development. **Research only —
deferred; player-facing curriculum changes are owner-gated.** Detail in UNI-003 §11.*

1. **Add a parallel "Methods" track** to the academic departments — Beginner/Intermediate/Advanced
   *method* courses graded by the existing gameplay practicals (the "earn it in your grow" half).
   *(Owner-gated: a `curriculum.yaml` shape change.)*
2. **Teach by mistake-correction** — turn the UNI-003 §2 mistakes table into micro-courses / the
   planned knowledge quizzes ("diagnose this, then fix it").
3. **First-class daily habit loop** — an in-game observation ritual nudging *observe → measure →
   minimal action → log*.
4. **Reward "do less"** — practicals/perks for the wet/dry cycle, half-dose starts, and one-change
   discipline, countering the game instinct to spam actions.
5. **Gate mastery on completed cycles** — keep `harvest_count`/`cure`/`harvest_quality` as the spine;
   don't let study-hours alone confer mastery.
6. **Build the plant-reading drills as the core mini-game** — spot-the-droop / deficiency-by-location
   / trichome-call / predict-then-verify, grading off the same `PlantState` the chamber renders.
7. **Mentor voice for the AI Professor** on Methods courses — "here's what I'd look at first," still
   CI-safe (mock when no key).
8. **Dedicated harvest & cure practicals** — elevate harvest-by-trichome and patient-cure, where the
   biggest real-world quality delta lives.
9. **Graduation validates instincts, not just perks** — a capstone *diagnose-and-fix / predict-and-
   verify* gauntlet.

> **Invariants preserved:** no new economy/faucet/token design is proposed; tuition-sink and
> perks-not-GROW invariants from `06-university.md` are untouched.

---

## Cross-links
- **Academic source (theory/degrees):** `docs/research/2026-06-08-cannabis-education-curriculum.md`
- **Methods source (UNI-003, practical pedagogy):** `docs/research/2026-06-14-master-grower-methods.md`
- **Genetics/agronomy deep research:** `docs/research/2026-06-08-cannabis-strain-genetics-and-cultivation.md`
- **Shipped university design canon:** `docs/memory/design/06-university.md`
- **Curriculum data (practical gates):** `src/growpodempire/data/curriculum.yaml`
- **The Professor (AI lecturer):** `src/growpodempire/ai/lecturer_claude.py`

---

## Records Report (UNI-010)

**Worker ID:** UNI-A10
**Assignment:** Integrate UNI-003 (Master Grower Methods) into the canonical GrowPod University
Master Bible; establish the university as Academic Curriculum + Methods Track with sections for
Practical Drills, Grower Habits, Plant Diagnostics, Troubleshooting Frameworks, and Recommended
Future Implementations.
**Done:** Created `GROWPOD_UNIVERSITY_MASTER_BIBLE.md` — a canonical consolidation that indexes both
tracks and all UNI-003 deliverables (§1–§7), with a Directive Index logging UNI-003 as
COMPLETE / Research-Only / Implementation-Deferred / Owner-Gate-required. The Bible summarizes and
links the source research rather than duplicating it, so detail stays single-sourced.
**Risks:** Low — doc-only; no code, economy, chain, or invariant touched. Numeric ranges (pH/RH/VPD)
are practical canon and carry a "confirm against `balance.yaml`/sim tuning before in-game use" note in
the source doc.
**Needs Lead:** Nothing blocking. One deferred, owner-gated decision: whether to add the **Methods
track** to `curriculum.yaml` when the university enters active development.
**Next:** Maintain the Directive Index as future university directives arrive; on greenlight, pair
each academic course with a Methods drill (UNI-003 §10).

### Final Report
- **Directive ID:** UNI-010
- **Lead Agent:** UNI-A00
- **Worker Agent:** UNI-A10
- **Reports Integrated:** UNI-003 (Master Grower Methods) — plus the two 2026-06-08 grounding research
  docs folded into the Academic track.
- **Canonical Changes:** New `GROWPOD_UNIVERSITY_MASTER_BIBLE.md` with the Directive Index + the
  Methods Track and supporting sections; cross-linked from `docs/memory/design/06-university.md`.
- **Recommendations:** Adopt the §2 mistakes table + §10 drills as seed content for the planned
  knowledge quizzes; add the parallel Methods track (owner-gated) when development begins.
- **Status:** ✅ COMPLETE — institutional knowledge preserved; implementation deferred.
