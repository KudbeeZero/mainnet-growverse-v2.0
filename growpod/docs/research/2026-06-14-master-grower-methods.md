# GrowPod University — Master Grower Methods (Practical Pedagogy) — Research Reference (2026-06-14)

> **Directive UNI-003** · Lead UNI-A00 · Worker UNI-A03 · for Records (UNI-A10) → *GrowPod University Master Bible*.
>
> Companion to the **academic** curriculum reference
> (`docs/research/2026-06-08-cannabis-education-curriculum.md`, which grounds the degree tree in real
> universities). **This** document is the other half: how *real master growers actually teach the craft*
> — the habits, instincts, observation skills, and mistake-correction loops that separate a beginner
> from someone who "feels like a grower." It is **practice-first**, grounded in proven cultivation
> experience rather than theory alone, per the directive. **Research only — no code, no monetization,
> no token design.**
>
> Where the academic doc answers *"what does a cannabis degree contain?"*, this one answers
> *"what does a master grower do every day, what do they look for, and what do they wish they'd
> learned sooner?"* The two are designed to interlock: theory (lectures/degrees) ↔ practice
> (habits/exercises/diagnosis). See **§9** for how this maps onto the shipped university model
> (`docs/memory/design/06-university.md`, `data/curriculum.yaml`).

---

## 0. Core thesis — how master growers actually teach

Experienced growers almost never teach theory-first. The consistent pattern across grow communities,
master-grower mentorships, and apprenticeship-style teaching is:

1. **The plant is the textbook.** "Grow the grower, not the weed." Beginners are taught to *read the
   plant* before they're taught the biochemistry behind what they're reading. The leaf tells you what
   the meter can't.
2. **Less is more (the cardinal lesson).** The single most-repeated master-grower correction to
   beginners is *do less*: less water, less nutrient, less fiddling. Most beginner deaths are from
   over-care, not neglect.
3. **One change at a time.** Diagnosis is impossible if you alter three variables at once. Master
   growers teach a disciplined change → wait → observe loop.
4. **Keep a journal.** Memory lies; the log doesn't. Every serious grower keeps records, and every
   mentor insists on it. The journal is what converts "I grew a plant" into "I learned to grow."
5. **Boring is good.** A stable, unremarkable environment day after day beats heroics. Mastery looks
   like *nothing dramatic happening* — flat lines on the environment chart, healthy plants, no panic.
6. **Reps compound.** You cannot shortcut grow cycles. Each full seed-to-cure run teaches things the
   previous one couldn't. Mastery is gated by *completed cycles*, not hours read.

> **Design north star for GrowPod University:** a graduate should leave with *instincts*, not just
> unlocked perks — they should glance at a plant and feel "that droop is happy-fed, not over-watered,"
> "those pistils aren't ready," "that smell means the cure is working." The university's job is to
> build those reflexes through repeated, observation-driven practice tied to real grow state.

---

## 1. The three roadmaps

Each roadmap lists **what the grower can reliably do**, **what they're learning to see**, and the
**graduation bar** (the instinct that says they're ready to move up). Stages map to the in-game
practical gates already supported (`harvest_count`, `harvest_quality`, `cure`, `breed`, `stabilize`,
`cup_entry`, `research`, `level`).

### 1A. Beginner roadmap — "Keep one plant alive, and finish the cycle"

**Goal:** complete one full seed → harvest → cure cycle without killing the plant, and understand
*why* it lived.

**Can do:**
- Germinate a seed and transplant without shocking the seedling.
- Set and hold a basic environment (light on a timer, temperature in range, gentle airflow).
- Water *on a wet/dry cycle by weight*, not on a fixed schedule.
- Recognize the three life stages by sight: seedling → vegetative → flowering.
- Identify the top three beginner failures *before* they kill the plant: over-watering, nutrient
  burn, light too close.
- Flush, harvest at roughly the right time, dry slowly, and start a basic cure.

**Learning to see:**
- The difference between a *thirsty* droop (leaves limp, light pot) and a *drowning* droop (leaves
  curled/clawed, heavy pot, wet medium). **This single distinction prevents most beginner deaths.**
- "Praying" top leaves (reaching up) = happy plant under good light.
- The first signs of nutrient burn (brown/crispy leaf tips) vs. deficiency (interior fade).

**Graduation bar (instinct):** *"I lift the pot to decide when to water, I don't water on a calendar,
and I can tell the difference between a hungry plant and a drowning one."*
**In-game gate:** `harvest_count ≥ 1` then `cure ≥ 1`.

### 1B. Intermediate roadmap — "Grow on purpose, dial the environment, fix problems"

**Goal:** repeatably produce *good* (not just alive) plants, diagnose and correct problems mid-grow,
and start steering quality.

**Can do:**
- Manage a full nutrient schedule and read/adjust by runoff (EC/pH in → EC/pH out), feeding *to the
  plant's appetite* rather than to the bottle's label.
- Maintain VPD/temperature/humidity by stage (warmer + humid in veg, cooler + drier in late flower).
- Apply basic plant training — topping, LST (low-stress training / tying down) — to build an even
  canopy and improve light penetration.
- Diagnose the common deficiencies by **mobility pattern**: mobile nutrients (N, P, K, Mg) show on
  *old/lower* leaves first; immobile (Ca, S, Fe, micros) on *new/upper* growth.
- Scout for and respond to early pest/mildew pressure before it becomes an infestation.
- Defoliate selectively, manage flowering, and time harvest by *trichome color* rather than calendar.

**Learning to see:**
- The whole-canopy picture: even tops, good airflow gaps, no light-bleached colas, no clawing.
- Reading flower progress: pistil color/recession and trichome milkiness as the real harvest signal.
- The "appetite" of a plant — fade timing, leaf tone telling you when to taper nutrients.

**Graduation bar (instinct):** *"I feed and steer the environment to the plant's response, I catch a
deficiency from which leaves are affected, and I harvest by looking at trichomes."*
**In-game gate:** `harvest_quality ≥ 70–85`, `cure ≥ 3`.

### 1C. Advanced roadmap — "Express the genetics, breed, and teach"

**Goal:** maximize a cultivar's *genetic potential*, work with genetics deliberately (selection,
crossing, stabilizing), and produce consistent, competition-grade results.

**Can do:**
- Pheno-hunt: run a population, select keepers on defined criteria (vigor, structure, nose, yield,
  resistance), and cull with discipline.
- Cross deliberately and **stabilize** a line over generations toward a goal.
- Advanced canopy/light/ripening management for peak quality and terpene expression.
- Dial drying and curing as a craft (slow dry, burp/monitor a cure to target water activity) — the
  step that most separates "good flower" from "great flower."
- Run a near-flat, boring, instrumented environment; troubleshoot subtle, compounding issues.
- Mentor a beginner: explain *why*, not just *what*.

**Learning to see:**
- Subtle phenotype differences across siblings; what's worth keeping vs. a near-miss.
- The signature of a *well-cured* batch (aroma development, proper moisture, smooth burn) vs. one
  rushed or over-dried.
- When "good enough" is actually leaving quality on the table.

**Graduation bar (instinct):** *"I can take a packet of seeds, find the keeper, stabilize what I like,
and finish it so the cure does the genetics justice — and I can teach someone else to do it."*
**In-game gate:** `breed`, `stabilize ≥ 1`, `harvest_quality ≥ 85+`, `cup_entry ≥ 1`.

---

## 2. The most common beginner mistakes (and the corrective lesson for each)

This is the heart of practical teaching: master growers teach largely *by mistake correction*. Each
entry is framed as **mistake → why it happens → the correction → the instinct it builds**. These are
ranked roughly by how often they kill or ruin a beginner's grow.

| # | Mistake | Why beginners do it | Correction (the lesson) | Instinct built |
|---|---------|--------------------|--------------------------|----------------|
| 1 | **Over-watering** | "More water = more love"; watering on a schedule | Water by *weight/wet-dry cycle*; let the medium dry; roots need oxygen too | Lift the pot before you reach for the can |
| 2 | **Over-feeding / nutrient burn** | Following bottle doses; "fix it with more food" | Start at **½ the recommended dose**; feed to the plant's response; burned tips = back off | Less is more; the plant tells you its appetite |
| 3 | **pH neglect (lockout)** | Don't own/use a pH meter | pH the water/feed into range (soil ~6.2–6.8; hydro/coco ~5.5–6.2); a deficiency is often *lockout*, not lack | Check pH *before* adding more nutrients |
| 4 | **Light too close / too intense** | Want max growth | Set distance to manufacturer/par guidance; bleaching & taco-ing leaves = back the light off | Read the canopy, not the spec sheet |
| 5 | **Wrong environment (heat/humidity)** | Ignore VPD; no airflow | Hold stage-appropriate temp/RH; add airflow; humidity too high in flower → mold | A boring, stable climate beats heroics |
| 6 | **Fiddling / changing too much at once** | Anxiety; can't leave it alone | **One change, then wait and observe**; resist daily intervention | Patience; isolate variables |
| 7 | **Harvesting too early** | Excitement; judging by pistils/calendar only | Harvest by **trichomes** (mostly cloudy/milky, some amber); pistils alone lie | Trust the trichomes, not the calendar |
| 8 | **Rushing / skipping the cure** | Want to sample now | Slow dry (~days, cool/dim/airflow) then **cure in jars with burping**; this is where quality is made or lost | The cure is part of the grow, not an afterthought |
| 9 | **No journal / no observation** | Seems unnecessary | Log water, feed, environment, and a daily photo; memory is unreliable | The log is how you actually learn |
| 10 | **Panic-reacting to every spot** | One yellow leaf ≠ emergency | A lower fan leaf yellowing in late flower is *normal* fade; diagnose before treating | Calm triage; not every symptom is a crisis |
| 11 | **Poor genetics / bad start** | Cheap/unknown seeds, weak clones | Start from known, healthy genetics; you can't out-grow bad genes | Genetics is the ceiling; care is how close you get |
| 12 | **Contamination / sloppy IPM hygiene** | No prevention mindset | Clean space, quarantine new plants, scout early; prevention beats cure | Hygiene first; scout before you spray |

> **Teaching note:** the corrective lessons cluster around *three reflexes* — **(a) do less, (b) read
> the plant, (c) change one thing at a time.** If a graduate internalizes only those three, they will
> out-perform a beginner who has memorized the whole nutrient chart.

---

## 3. Essential daily habits (the grower's routine)

Master growers run a short, consistent **daily walk-through**. The ritual itself is the skill — it
forces observation and catches problems while they're small. A practical daily routine:

1. **Observe before you touch.** Walk in, look, *don't fix anything yet*. Top-down and underside-of-
   leaf scan. Note color, posture (praying vs. drooping vs. clawing), new growth.
2. **Check the environment numbers.** Temp, humidity (→ VPD), CO₂ if relevant, light timer/height.
   Confirm they're in stage range and *stable* vs. yesterday.
3. **Assess water status by weight.** Lift pots / check medium moisture. Water *only if needed*, on
   the wet/dry cycle. When you feed, check runoff pH/EC.
4. **Scout for pests & disease.** Undersides of leaves, new growth, soil surface. Look for the first
   mite stippling, fungus-gnat adults, powdery mildew dusting. Early = cheap to fix.
5. **Inspect for deficiency/toxicity by location.** Old leaves vs. new growth; tips vs. interveinal.
   One change at a time if you act.
6. **Light training/maintenance.** Tuck, tie, or remove a few leaves for airflow/light — *gently and
   sparingly*. Most days this is nothing.
7. **Log everything.** Date, environment readings, what you fed/watered, observations, and a photo.
   The photo log is the single best learning tool a beginner has.
8. **Stage-specific check.** Flowering: trichome/pistil progress on a loupe every few days; late
   flower: watch humidity hard for mold.

> The habit-loop *is* the curriculum: **observe → measure → minimal action → record.** A grower who
> runs this loop for three full cycles has learned more than one who has read three books.

---

## 4. Observation & plant-reading skills (the core craft)

This is what most separates experts from beginners, and it's the hardest to teach from theory.
Master growers break "reading a plant" into concrete, learnable cues:

**Posture / turgor**
- **Praying** (top leaves angled up, taut): happy, good light/health.
- **Thirst droop** (leaves limp/soft, pot light): needs water — recovers fast after watering.
- **Over-water droop** (leaves curled down/clawed, *firm/swollen*, pot heavy, medium wet): roots
  suffocating — the opposite fix from thirst. **Confusing these two is the #1 beginner error.**
- **Taco/canoe** (edges curling up): heat or light stress.
- **Clawing** (tips hooked down): often nitrogen toxicity / overfeeding.

**Color & pattern (deficiency reading by *location*)**
- **Mobile nutrients → old/lower leaves first:** N (uniform pale/yellow, whole-plant fade), Mg
  (interveinal yellowing lower leaves), K (rusty/burnt leaf margins), P (dark/purpling, dull).
- **Immobile nutrients → new/upper growth first:** Ca (new-growth distortion/spotting), S (uniform
  new-leaf paling), Fe (bright interveinal yellowing on the *newest* leaves).
- **Tips/margins burnt** = excess (nutrient burn / salt), not deficiency.
- **Always suspect pH lockout before "add more."**

**Flowering & ripeness**
- **Pistils:** white & reaching = immature; browning/curling inward = progressing — but pistils are a
  *rough* guide and can be triggered by handling/weather.
- **Trichomes (the real signal, via loupe/scope):** clear = too early; **cloudy/milky = peak
  potency**; amber = more sedative/degraded. Harvest window is judged here.
- **Fade:** intentional late-flower leaf yellowing as the plant finishes is normal and even desirable.

**Smell**
- Vegetative green smell → developing terpene aroma in flower → the "off" ammonia/hay smell that
  signals a **bad/rushed cure** or rot. Nose is a real instrument.

> **Exercise the eye, not the meter.** A master grower predicts what the meter will say *before*
> looking at it, then uses the meter to confirm. That predict-then-verify loop is the trainable skill.

---

## 5. Environmental troubleshooting (the systems view)

Beginners treat symptoms; experts find the *upstream* cause. The master-grower troubleshooting order:

1. **Environment first, plant second.** Most "deficiencies" are actually environment/root-zone
   problems (heat, over-water, pH, EC). Check climate and root zone before reaching for a nutrient
   bottle.
2. **The big four root-zone levers:** moisture (wet/dry), oxygen (drainage/airiness), pH, EC/salt
   load. Most root problems are one of these.
3. **The big climate levers:** temperature, humidity → **VPD**, airflow, light intensity/distance,
   CO₂. Stage-appropriate targets (veg = warmer/humid; flower = cooler/drier; late flower = drier
   still to fight mold).
4. **Isolate with one change.** Adjust a single variable, then wait a full observation period
   (often days) before judging.
5. **Severity triage:** mold/rot/pests/heat → act now; slow fade on lower leaves in late flower →
   often normal, log and watch.

| Symptom cluster | Likely upstream cause | First move |
|-----------------|----------------------|-----------|
| Droopy + heavy wet pot | Over-watering / poor drainage | Stop watering; improve airflow/drainage; let dry |
| Droopy + light dry pot | Under-watering | Water; shorten dry-back |
| Tips burnt, lush dark leaves, clawing | Over-feeding (N toxicity) | Reduce EC; flush if severe |
| Interveinal yellowing, lower leaves | Mg deficiency *or* pH lockout | Check pH first; then Mg |
| New-growth distortion/spotting | Ca/micro lockout (often pH/RH/VPD) | Fix pH + climate before dosing |
| Leaf edges tacoing, bleached tops | Heat / light too intense | Raise light, lower temp |
| Powdery white dust / fuzzy rot | Humidity + poor airflow | Drop RH, add airflow, remove affected |
| Stippled/speckled leaves, webbing | Spider mites | Isolate, treat, raise hygiene |

---

## 6. Nutrient management & deficiency diagnosis (practical)

The practical (not academic) framing master growers use:

- **Feed the plant, not the schedule.** Bottle schedules are a *starting* guess. Start low
  (½-strength is the classic beginner-safe rule), watch the response, and ramp to appetite.
- **pH is the gatekeeper.** Right nutrients at the wrong pH = lockout that *looks* like deficiency.
  Soil ~6.2–6.8; coco/hydro ~5.5–6.2. pH every feed.
- **EC/PPM = how much, pH = whether it's available.** Read runoff: rising runoff EC = plant isn't
  eating it all (back off); pH drift signals root-zone trouble.
- **Mobility is the diagnostic key** (see §4): *old leaves* = mobile element moving away (N/P/K/Mg);
  *new growth* = immobile element (Ca/S/Fe/micros).
- **Fade & flush.** Late flower, taper feed; the plant pulls stored nutrients and fades — desirable.
  Avoid over-feeding into the finish.
- **When in doubt, plain water.** Over-fed plants recover from a flush; the reflex "add more nutrients"
  is usually wrong.

**Diagnostic flow (teachable as a decision tree):**
`Symptom → Where? (old vs new leaves, tip vs interveinal) → Check pH/EC + environment first →
Suspect lockout before lack → Change ONE thing → Wait & observe → Log result.`

---

## 7. Training, canopy, flowering, and harvest decision-making

**Training (manage the canopy, manage the light):**
- **Topping/FIMing:** remove the apical tip to create multiple colas, flatter canopy. Do it in veg,
  let recover.
- **LST (low-stress training):** bend & tie branches down to open the canopy and even the tops —
  beginner-safe, high return.
- **Defoliation:** selectively remove leaves blocking bud sites / trapping humidity — *sparingly*;
  over-defoliation stresses the plant.
- **Goal:** an even, well-lit, airy canopy. "Flat green table, light reaches everything, air moves
  through."

**Flowering management:**
- Flip to 12/12 (photoperiod) once the plant has the size you want — it stretches ~1.5–2×.
- Lower humidity progressively; airflow up; watch for mold in dense colas.
- Support heavy colas; manage late-flower nutrition toward the fade.

**Harvest decision (the master-grower call):**
- **Trichomes are the verdict** (loupe/microscope): mostly cloudy = peak; a little amber = fuller
  body/more sedative; mostly clear = wait.
- Pistils and breeder week-counts are *supporting* signals, not the decision.
- Harvest window is a *choice*, not a deadline — earlier = brighter/heady, later = heavier/couch.
  Teaching the *trade-off* matters more than teaching one "right" day.

---

## 8. Drying & curing (where quality is won or lost)

Master growers are near-unanimous: **the cure is half the result, and it's where beginners throw
quality away.**

- **Dry slow and cool.** Hang/dry in a dark, ~60°F / ~60% RH, gently moving air; aim for a multi-day
  dry (small stems snap, don't bend) — *not* a fast dry that locks in chlorophyll/"hay."
- **Then cure in sealed jars/containers.** Burp daily at first to release moisture and gases; target
  a stable internal moisture (the "water activity" the academic track measures). Cure for weeks; it
  keeps improving for the first month-plus.
- **Read the cure by nose and feel:** harsh/grassy/ammonia = too wet or rushed; smooth developing
  aroma = working; bone-dry/crumbly = over-dried (lost terpenes).
- **Patience is the whole lesson.** The biggest beginner upgrade isn't a better light — it's *not
  rushing the dry and cure.*

---

## 9. Skills that separate beginners from experts (the instinct ladder)

| Dimension | Beginner | Master |
|-----------|----------|--------|
| **Water** | Waters on a schedule | Waters by weight/feel, to the wet-dry cycle |
| **Feed** | Follows the bottle | Feeds to the plant's appetite; starts low |
| **Diagnosis** | Treats the symptom, adds more | Finds the upstream cause; suspects pH/environment first |
| **Intervention** | Fiddles daily, changes many things | Changes one variable, then waits |
| **Reading** | Sees "a green plant" | Reads posture/color/location/trichomes/smell |
| **Harvest** | By calendar/excitement | By trichomes, as a deliberate trade-off |
| **Cure** | Rushes to sample | Treats dry/cure as craft; patient |
| **Records** | None / memory | Journals every cycle; predicts then verifies |
| **Mindset** | Panic & over-care | Calm, boring, stable; "do less" |
| **Genetics** | Whatever seed | Selects, breeds, stabilizes toward a goal |

The throughline: **experts have converted knowledge into reflexes through completed cycles.** You
cannot read your way there — you have to *finish grows and keep records.*

---

## 10. Recommended practical exercises (drills that build the instincts)

Designed to be **observation- and decision-driven** and to map onto in-game state checks. Each drill
targets a specific reflex.

1. **Lift-to-water drill.** Decide watering by pot weight/medium feel, never by date, for a full
   cycle. *Builds:* the anti-over-watering reflex. *In-game:* track watering-by-need, not schedule.
2. **Half-dose start.** Begin nutrients at ½ label strength and ramp only on plant response.
   *Builds:* "less is more," appetite-reading.
3. **Spot-the-droop.** Present thirst-droop vs. over-water-droop side by side; force the correct
   diagnosis + opposite fix. *Builds:* the single most valuable beginner distinction.
4. **Deficiency-by-location.** Given a symptom, ask *old vs. new leaf? tip vs. interveinal?* before
   naming the nutrient — and check pH first. *Builds:* the mobility diagnostic + lockout reflex.
5. **One-change discipline.** A scenario tempts the player to change three things; reward changing
   one and waiting. *Builds:* variable isolation, patience.
6. **Trichome call.** Show trichome states (clear/cloudy/amber); player picks the harvest window and
   states the trade-off. *Builds:* harvest-by-trichome instinct.
7. **The cure hold.** Reward *waiting* through a slow dry + multi-week cure vs. rushing; show the
   quality delta. *Builds:* patience, the highest-ROI beginner upgrade.
8. **Daily walk-through.** A repeatable "observe → measure → minimal action → log" loop each in-game
   day. *Builds:* the core habit-loop.
9. **Pheno-hunt & cull (advanced).** Run a population, score on set criteria, keep one, justify the
   cull. *Builds:* selection discipline.
10. **Stabilize a line (advanced).** Cross toward a goal trait and hold it over generations.
    *Builds:* breeding intent.
11. **Journal-and-predict.** Before checking a meter/readout, the player *predicts* it from the
    plant; score the prediction. *Builds:* the predict-then-verify master skill.

---

## 11. Recommendations for GrowPod University implementation (research-only)

> These are *design recommendations* for the Records/curriculum team, not code. They show how the
> practical pedagogy above interlocks with the **already-shipped** university model
> (`docs/memory/design/06-university.md`; practical types in `data/curriculum.yaml`:
> `harvest_count · harvest_quality · breed · stabilize · cure · cup_entry · research · level`).

1. **Add a practical "Methods" spine alongside the academic departments.** The current 6 departments
   are theory-named (Cultivation, Genetics, Nutrients, IPM, Chemistry, Post-Harvest). Recommend a
   parallel **practice ladder** — Beginner / Intermediate / Advanced *method* tracks (§1) — whose
   courses are graded by the existing gameplay practicals, not by lecture comprehension. This is the
   "earn it in your grow" half the design already espouses.
2. **Teach by mistake-correction, not just lecture.** The §2 mistake table is the richest seam. Each
   mistake → corrective-lesson pair is a natural **micro-course or quiz item** (the design already
   lists "knowledge quizzes" as planned). Frame lessons as *"diagnose this, then fix it,"* graded
   against live plant state.
3. **Make the daily walk-through (§3) a first-class habit loop.** Recommend an in-game **daily
   observation ritual** that nudges *observe → measure → minimal action → log*. This turns the
   habit itself into trainable, rewardable behavior — the single best beginner-→-grower converter.
4. **Reward "do less."** Most game loops reward *more* actions; cultivation mastery rewards
   *restraint.* Recommend practicals/perks that explicitly reward the wet/dry cycle, half-dose
   starts, one-change discipline, and *not* over-intervening — countering the natural game instinct
   to spam actions.
5. **Gate mastery on completed cycles, which the model already does.** `harvest_count` / `cure` /
   `harvest_quality` thresholds already encode "reps compound." Keep cycle-completion as the true
   spine of progression; resist letting study-hours alone confer mastery.
6. **Build the plant-reading drills (§10) as the core mini-game.** A *spot-the-droop* /
   *deficiency-by-location* / *trichome-call* / *predict-then-verify* drill set is the most faithful
   translation of master-grower teaching into interactive form — and it directly trains the instincts
   in §9. These can grade off the same live `PlantState` the chamber renders.
7. **Let the AI Professor teach in the practical voice for these tracks.** The shipped lecturer
   (`ai/lecturer_claude.py`) is grounded in rigorous science; for the Methods spine recommend a
   complementary *mentor* register — "here's what I'd look at first," mistake-correction tone — while
   keeping it CI-safe (mock when no key), per the existing invariant.
8. **Cure & harvest deserve dedicated practicals.** The `cure` practical already exists; recommend
   elevating harvest-by-trichome and the slow-dry/patient-cure as explicit, separately-graded
   lessons, since they're where the biggest real-world quality delta lives (§7–8).
9. **Graduation feel = instincts, not just perks.** A graduate should *feel* like a grower (§ "Think
   big," below). Recommend the capstone validate the **reflexes** (a final predict-then-verify /
   diagnose-and-fix gauntlet) rather than only checking accumulated thresholds.

> **Interlock summary:** academic doc → *degrees/lectures/theory*; this doc → *habits/exercises/
> diagnosis/instincts*. The two should be cross-referenced so each course can pair a **lecture**
> (theory) with a **practical drill** (instinct). No new economy/faucet/token design is proposed —
> tuition-sink and perks-not-GROW invariants from `06-university.md` are untouched.

---

## THINK BIG — what a GrowPod University graduate should *feel* like

If a player graduates, they should walk into any grow and have **instincts**, not a checklist:

- They **lift the pot** before watering — reflexively, without thinking "schedule."
- They **read posture and color** and know *thirsty vs. drowning, hungry vs. burnt, lockout vs. lack*
  at a glance.
- They **suspect the environment and the pH first**, and they reach for *plain water and patience*
  before "more nutrients."
- They **change one thing and wait.** They're calm. A single yellow lower leaf in late flower doesn't
  spook them.
- They **call the harvest off the trichomes** and treat it as a deliberate trade-off, not a deadline.
- They **respect the cure** — they'd never rush a dry, because they know that's where the quality is.
- They **keep a journal**, and they can **predict the meter before they read it.**
- At the top: they can **find the keeper in a pack of seeds, stabilize what they love, and teach a
  beginner why.**

That's the deliverable: not a player who *unlocked* cultivation, but one who has the **reflexes of a
grower** — earned the way real growers earn them, one completed, recorded cycle at a time.

---

## Cross-links & grounding
- **Academic companion (theory/degrees):** `docs/research/2026-06-08-cannabis-education-curriculum.md`
- **Genetics/agronomy deep research:** `docs/research/2026-06-08-cannabis-strain-genetics-and-cultivation.md`
- **University design (shipped model):** `docs/memory/design/06-university.md`
- **Curriculum data (practical gates):** `src/growpodempire/data/curriculum.yaml`
- **Sim/horticulture & genetics design:** `docs/memory/design/01-simulation-horticulture.md`,
  `docs/memory/design/02-genetics.md`
- **The Professor (AI lecturer):** `src/growpodempire/ai/lecturer_claude.py`

> **Method/sourcing note:** This is a *synthesis of common, broadly-agreed master-grower practice*
> as taught across grow communities and mentorship-style cultivation teaching — the practical canon
> (water-by-weight, ½-dose starts, mobility-based deficiency reading, trichome harvest, slow cure,
> journal-keeping, "do less," one-change-at-a-time). It is intentionally framed as *pedagogy*, not as
> lab-cited agronomy; the academic companion doc carries the university/peer-reviewed grounding.
> Where specific numeric ranges appear (pH, RH/temp, VPD), they are widely-published practical
> targets and should be confirmed against `balance.yaml`/sim tuning before any in-game use.

---

## Report (per directive UNI-003)

**Directive ID:** UNI-003
**Lead Agent:** UNI-A00
**Worker Agent:** UNI-A03
**Asked:** Research how real master growers teach cannabis cultivation and build a practical,
experience-based curriculum (roadmaps, common mistakes, daily habits, observation/diagnosis skills,
training/flowering/harvest/cure, and GrowPod University implementation recommendations) — research
only, no code/monetization/tokens.
**Done:** Delivered all seven required artifacts in this document — beginner/intermediate/advanced
roadmaps (§1), common-mistakes-with-corrections table (§2), essential daily habits (§3),
observation/plant-reading + environmental-troubleshooting + nutrient/deficiency + training/flower/
harvest + dry/cure skills (§4–8), the beginner→expert instinct ladder (§9), practical exercises/drills
(§10), and research-only implementation recommendations that interlock with the shipped university
model (§11). It is the *practical* companion to the existing *academic* curriculum research.
**Risks:** Low. Doc-only; touches no code, economy, chain, or invariants. Numeric ranges (pH/RH/VPD)
are practical canon and should be reconciled with `balance.yaml`/sim tuning before any in-game wiring.
**Needs You:** Nothing blocking. Decision for later (Records/owner, not this directive): whether to
add the recommended **practical "Methods" track** as a parallel spine in `curriculum.yaml` — a
player-facing curriculum-shape change, so owner-gated per the charter.
**Next:** Hand to Records (UNI-A10) for consolidation into the GrowPod University Master Bible; pair
each academic course with a practical drill from §10 when the Methods track is designed.

**Observations:** The shipped university already has the right bones — `practical` gates tied to live
gameplay (`harvest_count/quality/cure/breed/stabilize/cup_entry`) — so the practical pedagogy here
maps onto existing mechanics without new systems. The biggest unrealized opportunity is the
**plant-reading drill set** (§10) as a core mini-game grading off the same `PlantState` the chamber
renders.
**Recommendation:** Adopt the §2 mistake-correction table and §10 drills as the seed content for the
planned "knowledge quizzes," and add a parallel Beginner/Intermediate/Advanced **Methods** track so
the university teaches *instincts*, not just degrees.
