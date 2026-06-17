# GrowPod University — Curriculum Architecture (Research) — 2026-06-14

> **Directive UNI-001** · Lead Agent **UNI-A00** · Worker Agent **UNI-A01**
> **Research only.** No code, no Phase-1 scoping, no monetization, no token systems. This document
> designs the **educational progression + engagement architecture** for GrowPod University — the
> Duolingo/Khan-Academy-grade *learning loop* that sits **on top of** the curriculum content that
> already ships (`src/growpodempire/data/curriculum.yaml`, `services/university_service.py`, the AI
> Professor stack). It is the structural blueprint for consolidation into the **GrowPod University
> Master Bible** by Records (UNI-A10).

---

## 0. Scope, grounding, and how this fits what already exists

GrowPod already has the **content half** of a university (design: `docs/memory/design/06-university.md`;
research grounding: `docs/research/2026-06-08-cannabis-education-curriculum.md`):

- **6 departments**, ~14 real-named courses, prereq chains, and **5 degree tiers** (Certificate →
  Associate → Bachelor → Master, Doctorate planned).
- A course completes on **time studied + a practical proven in the live grow**; degrees grant
  **permanent perks** (shared effect-keys with the research tree) + a prestige **title** + XP.
- An **AI Professor** delivers real-looking, science-grounded lectures (CI-safe mock + real Claude).

What is **missing** — and what this directive supplies — is the **engagement architecture**: the
*shape* of a lesson, the moment-to-moment learning loop, the XP/streak/league systems that make a
player *want to come back tomorrow*, the certification/badge ladder beneath the degrees, the
achievement layer, and a graduation ceremony. We are designing **the retention engine of a learning
product**, mapped onto the cannabis-cultivation curriculum that already exists.

> **Design constraint inherited from `CLAUDE.md`:** this is the *earned-mastery* moat — knowledge
> earned over **real time** and **proven in the grow**, not bought. Every mechanic below must
> preserve that: engagement systems may **never** become a faucet, never let a player *buy* mastery,
> and never break the "growing doesn't happen overnight" ethos. Streaks reward *showing up*, not
> *spending*. (Monetization/tokens are explicitly out of scope per the directive.)

---

## 1. RESEARCH — what the best learning products actually do

A condensed field study of the systems the directive named, distilled to the **mechanics worth
stealing** and the **traps to avoid**. Sources are the public, well-documented behaviour of these
products and the learning-science literature behind them (spaced repetition, mastery learning,
self-determination theory, variable reward).

### 1.1 Duolingo — the engagement benchmark
- **Skill tree / path:** a single, mostly-linear **path** of small units; the next node unlocks when
  the current one is cleared. Reduces decision paralysis ("what do I do now?") to near zero. Modern
  Duolingo abandoned the wide branching tree for a **guided path** precisely because choice paralysis
  hurt completion.
- **Bite-size lessons:** 3–7 minutes, 12–20 micro-exercises. The unit of progress is small enough to
  finish in a queue or an elevator. **This is the single most important retention mechanic.**
- **XP + daily goal:** every lesson grants XP; the player sets a **daily XP goal** (Casual 10 / Regular
  20 / Serious 30 / Intense 50). Hitting the goal is the day's "win."
- **Streaks + Streak Freeze:** consecutive days of hitting the goal. The **loss-aversion** of a long
  streak is the dominant return driver. **Streak Freeze** (and weekend "streak repair") deliberately
  *protects* streaks because a broken streak often means a churned user — the freeze is a retention
  tool, not a kindness.
- **Leagues (Leaderboards):** weekly promotion/relegation tournaments (Bronze → … → Diamond) group ~30
  players by XP. Competition manufactures a *reason* to do "one more lesson." Opt-in-feeling but
  default-on.
- **Hearts / energy:** a mistake economy that gates *how much* you can practice before a rest. (We
  treat this as a **trap** for our context — see §1.6.)
- **Crown / mastery levels:** a skill can be **leveled up** (re-practiced at higher difficulty) to a
  "legendary/crown" state — **mastery beyond first-pass completion**, which is exactly our "prove it
  in the grow, then prove it *better*" angle.
- **Spaced repetition / "practice" sessions:** surfaces previously-learned material for review,
  scheduled by a forgetting-curve model. Retention of *content*, not just engagement.

### 1.2 Codecademy — learning-by-doing + structured paths
- **Career/Skill Paths:** long, ordered sequences with a clear **end-state identity** ("Front-End
  Engineer"). The *destination* is a job title — aspirational, identity-shaped. Our analog: **degrees
  and grower titles**.
- **Interactive, do-it-to-learn:** you write real code in-lesson and it's checked immediately. The
  *practical is the lesson*. GrowPod's "prove it in your grow" practical is the same philosophy —
  we should pull the practical **earlier**, into the lesson loop, not only at course completion.
- **Projects + Portfolio:** capstone projects you keep. Our analog: a **transcript / trophy case** and
  signature harvests tied to a course.
- **Progress %, "X% complete," and resume-where-you-left-off:** low-friction re-entry.

### 1.3 Khan Academy — mastery learning + knowledge graph
- **Mastery levels per skill:** *Attempted → Familiar → Proficient → Mastered.* You don't "pass"; you
  **climb a mastery ladder** per skill, and mastery **decays** if not refreshed — review brings it
  back up. This is the gold standard for "did they actually *learn* it."
- **Knowledge map / prerequisite graph:** skills have explicit prereqs; the system can *recommend* the
  next best thing. GrowPod already has prereq chains — we formalize them into a **visible map**.
- **Mastery points + Course Challenge:** points awarded for *raising* mastery (not just activity), and
  a **course challenge** that lets a knowledgeable player **test out** of material. Respect the
  player's existing knowledge.
- **Energy points / badges (early KA):** a broad **badge taxonomy** by difficulty (Meteorite → Moon →
  Earth → Sun → Black Hole) and category (streak, skill, mastery, community, "challenge patches").
  A rich, *legible* achievement vocabulary.

### 1.4 Cross-cutting learning-science principles (the "why")
- **Spaced repetition** beats cramming for long-term retention (Ebbinghaus forgetting curve).
- **Mastery learning** (Bloom): advance on *demonstrated competence*, not seat-time alone. GrowPod's
  practical gate is already mastery-flavoured; we deepen it.
- **Self-Determination Theory** (autonomy, competence, relatedness): the durable motivators are
  *feeling capable*, *choosing your path*, and *belonging*. Streaks/leagues feed competence +
  relatedness; the department/elective structure feeds autonomy.
- **Variable reward + goal-gradient:** progress bars that *accelerate near the end*, surprise bonuses,
  and "you're 80% there" nudges drive completion.
- **Loss aversion** (streaks) is more powerful than gain — but **over-punishing** loss drives churn,
  hence freezes.

### 1.5 Lesson-length findings (consolidated)
| Product | Lesson length | Session target | Unit of "a win" |
|---|---|---|---|
| Duolingo | 3–7 min | 1–3 lessons (~15 min) | hit daily XP goal |
| Khan Academy | 4–10 min video + practice | raise one skill's mastery | mastery level up |
| Codecademy | 5–15 min interactive | finish a module step | module complete |
| **GrowPod target** | **3–6 min "Lesson"; ~15–20 min "Lab"; multi-day "Course"** | **a Lesson/day min; a Lab/session** | **finish a Lesson + advance a practical** |

The crucial GrowPod twist: our content has **two clocks** — the *cognitive* clock (read/quiz, minutes)
and the *cultivation* clock (the practical, real grow-time/days). A great design **decouples** them so
a player always has a 3-minute thing to do *today* even while a multi-day practical ripens.

### 1.6 Traps to **avoid** (anti-patterns for our context)
- **Hearts/energy that block learning.** Punishing wrong answers by *locking the player out* is hostile
  to a *teaching* product and clashes with our owner ethos. **Reject** a lives economy gating lessons.
- **Streak shame / aggressive guilt loops.** Loss-aversion works; weaponized FOMO churns and erodes
  trust (`docs/memory/design/04-honesty-and-trust.md`). Use **freezes + grace**, not guilt.
- **Pay-to-skip mastery.** Out of scope here, but flagged as an invariant: a degree must never be
  buyable. Tuition is a *sink that starts the clock*, not a *skip button*.
- **Leaderboard toxicity / whales dominating.** XP leagues must be **bracketed by cohort/level** so a
  veteran can't camp a beginner board. Consider **separate "knowledge XP"** that can't be farmed by
  pure grinding.
- **Choice paralysis.** Offer a **recommended next** (single highlighted node) even though the map is
  explorable.

---

## 2. DELIVERABLE 1 — Complete course hierarchy

A **four-level containment hierarchy**, mapping the engagement vocabulary onto the existing content:

```
COLLEGE  (the whole University — the campus)
  └── DEPARTMENT  (a field of study — already 6, growing to ~9)
        └── COURSE  (a real-named class; the unit that grants a perk + counts toward a degree)
              └── MODULE  (a themed chunk of a course; the unit that grants a BADGE)
                    └── LESSON  (the 3–6 min atomic learning loop; grants XP + mastery)
                          └── EXERCISE  (a single quiz item / interaction inside a lesson)

Cross-cutting:
  PRACTICAL   — a real-grow proof attached to a Course (and previewed at Module level)
  CERTIFICATE / BADGE — earned at Module/Course level (micro-credential ladder)
  DEGREE      — earned by completing a required set of Courses (5 tiers + Doctorate)
  TITLE       — prestige string granted by a Degree (permanent, worn on profile)
```

### 2.1 The campus map (Beginner → Intermediate → Advanced pathways)
Three **tracks** layered over the departments, so a newcomer always sees a clear on-ramp and a
veteran always has a frontier:

| Track | Level band | Departments emphasized | Player feeling |
|---|---|---|---|
| **Freshman / Beginner** | L1–5 | Cultivation, Post-Harvest basics | "I can grow a plant and not kill it." |
| **Undergraduate / Intermediate** | L5–15 | Nutrients, IPM, Genetics intro, Environmental control | "I can *steer* a grow and start to breed." |
| **Graduate / Advanced** | L15–30+ | Genetics & Breeding, Chemistry, Lab/QA, Compliance | "I read CoAs, stabilize lines, and teach others." |

### 2.2 Departments (existing 6 + 3 planned, from the design doc's roadmap)
1. **Cultivation & Horticulture** (exists) — the spine; everyone starts here.
2. **Post-Harvest & Processing** (exists) — dry/cure/store; pairs early with Cultivation.
3. **Soil & Nutrient Science** (exists).
4. **Integrated Pest Management** (exists).
5. **Plant Genetics & Breeding** (exists) — the gateway to the breeding metagame.
6. **Cannabis Chemistry** (exists) — cannabinoids/terpenes/analytics.
7. **Lab Analytics & QA** (planned) — GC/HPLC, CoA literacy.
8. **Business, Law & Compliance** (planned).
9. **Pharmacology & Medical** (planned).

### 2.3 The honors spine vs. electives (autonomy with a guide rail)
- A **required spine** per track (the "recommended next" path — Duolingo's guided line) guarantees a
  beginner never gets lost.
- **Electives** (e.g. start IPM before you *need* it, or rush Genetics) feed the **autonomy** motivator
  and let players express a playstyle (breeder vs. connoisseur vs. commercial-yield).

---

## 3. DELIVERABLE 2 — Module breakdowns

A **Course** decomposes into **3–6 Modules**; a Module is the unit that earns a **badge** and previews
its Course's practical. Modules follow a consistent **5-beat arc** (the "learning loop"):

```
MODULE ARC  (each module, ~15–25 min total across several short lessons)
  1. HOOK        — 1 lesson: why this matters in *your* grow (Professor cold-open, ties to a live plant).
  2. CONCEPT     — 1–2 lessons: the science, bite-size, with the AI Professor lecture as source text.
  3. CHECK       — 1 lesson: a deterministically-graded quiz (knowledge mastery).
  4. APPLY       — the PRACTICAL preview: a small, observable action in the live grow.
  5. REFLECT     — recap + "what unlocked" + the next recommended node (goal-gradient nudge).
```

**Worked example — `cult-201` "Environmental Control: VPD & DLI"** (a real existing course):

| Module | Theme | Lessons (3–6 min each) | Module badge | Practical thread |
|---|---|---|---|---|
| M1 | Transpiration & VPD basics | What is VPD · Reading the leaf · VPD by stage | 🌫️ *Vapor Reader* | observe VPD on a live plant |
| M2 | Light as a lever (DLI/PPFD) | PPFD vs DLI · DLI targets by stage · light stress | ☀️ *Photon Wrangler* | hold a plant in target DLI band |
| M3 | Steering the canopy | Combining VPD+DLI · diagnosing a stall | 🎚️ *Canopy Steersman* | **course practical:** harvest_quality ≥ 70 |

The **module badges** are a micro-credential layer (cheap, frequent dopamine) *beneath* the course's
single perk — so a player gets 3 "wins" across a course instead of one, which is the Khan-Academy
lesson: **make progress legible and frequent.**

### 3.1 Module → mastery mapping (Khan-style)
Each module tracks a per-skill **mastery state**, decoupled from course completion:
`Attempted → Familiar → Proficient → Mastered → Legendary`.
- **First-pass** completion = *Familiar/Proficient* (enough to bank the badge + advance).
- **Mastered/Legendary** = re-practice at higher difficulty + a *better* practical (e.g. quality ≥ 85),
  which is where **Crown/legendary** mechanics (Duolingo) meet **mastery decay** (Khan): unrefreshed
  mastery **drifts down one tier over time**, and a quick review session restores it. This is the
  spaced-repetition retention hook — and it gives long-term players a reason to *return to old
  material*, not just push the frontier.

---

## 4. DELIVERABLE 3 — Lesson progression

### 4.1 The atomic lesson (the 3–6 minute loop)
```
LESSON
  ├─ Intro card        (10s: the one idea)
  ├─ 8–16 EXERCISES    (mix of types below; immediate feedback each)
  ├─ Mastery check     (did you clear the bar? → raise mastery)
  └─ Reward beat       (XP + streak credit + "next" nudge)
```

**Exercise types** (deterministically graded so they're CI-testable and fair — mirrors the existing
"deterministic practical checks" invariant):
- **Recall MCQ** — "Which deficiency is interveinal chlorosis on *new* growth?"
- **Identify** — tap the pest/deficiency on an image of a leaf (ties to existing leaf-morphology art).
- **Order/sequence** — arrange the cure steps; arrange the seed-to-harvest stages.
- **Match** — terpene → aroma; cannabinoid → effect; nutrient → mobility.
- **Numeric/slider** — "set VPD for late flower" (graded to a tolerance band).
- **Scenario/diagnose** — read a (synthetic) plant readout, pick the intervention.
- **Live-grow micro-task** — the bridge exercise that hands you to the practical.

### 4.2 Progression gating (unlock requirements)
A node unlocks when **all** of its gates pass — reusing the *existing* gating vocabulary so this stays
implementable later without new primitives:

| Gate | Source | Example |
|---|---|---|
| **Prereq nodes** | existing `prereqs[]` | `cult-201` needs `cult-101` |
| **Level requirement** | existing `level_req` | `chem-301` needs L12 |
| **Knowledge mastery** | new: module quiz score | "Proficient" in M1 to start M2 |
| **Practical proof** | existing practical types | harvest_count / quality / breed / cure / cup_entry / research / level |
| **Study clock** | existing `duration_hours` | the real-time gate that makes a degree an investment |

**Test-out / placement (Khan "Course Challenge"):** a player who *already knows it* (e.g. a veteran on
an alt path) can attempt a **placement challenge** to jump mastery to Proficient without grinding every
lesson — respecting prior competence. The **practical and study-clock gates still apply** (you can test
out of *knowledge*, never out of *proving it in the grow*). This protects the moat.

### 4.3 Two-clock decoupling (the key GrowPod innovation)
Because practicals run on grow-time, the lesson loop must always offer **something to do today**:
- **Knowledge track** (minutes): lessons/quizzes/review — always available, drives daily streak.
- **Practical track** (days): the grow proof — ripens in the background.
- A course shows **two progress bars** ("Coursework 80% · Practical: awaiting harvest"), so a player
  feels progress daily even while the practical matures. This is how we get Duolingo daily-habit
  cadence *without* faking the cultivation clock.

### 4.4 The recommended-next engine (anti-paralysis)
At any moment the campus highlights **one** "Continue" node chosen by: nearest-to-complete course →
lowest-friction unlock → spine before electives → a due **review** if mastery has decayed. The map is
fully explorable, but there's always a single glowing default.

---

## 5. DELIVERABLE 4 — Certification structure

A **micro-credential ladder** so recognition is frequent at the bottom and prestigious at the top.
This sits *beneath and around* the existing 5 degree tiers; it does not replace them.

```
BADGE          (per Module)         — dozens; frequent; cosmetic + tiny flavor.
CERTIFICATE    (per Course/skill)   — "Certified in VPD Steering"; the existing course perk lives here.
SPECIALIZATION (per Department arc) — finish a department's spine → a department seal + title fragment.
DEGREE         (per required set)   — the existing 5 tiers: Certificate→Associate→Bachelor→Master.
DOCTORATE      (capstone)           — planned endgame tier: an original contribution (see §5.2).
HONORARY / DEAN'S LIST             — seasonal/competition recognition (ties to Cup standing).
```

### 5.1 Degree tiers (existing) + their gamified envelope
The content/perks already exist; here is the **engagement framing** wrapped around each:

| Tier | "Feel" | Gate shape | Reward envelope |
|---|---|---|---|
| **Certificate** | first real credential | 1–2 intro courses + 1 practical | first **title**, profile badge, "you're official" ceremony |
| **Associate** | competent generalist | department spine + cross-dept practical | bigger perk stack, **Dean's List** eligibility |
| **Bachelor** | specialist | a major (deep dept) + electives + harder practical (e.g. stabilize a line) | prestige title, campus cosmetic, alumni status |
| **Master** | authority | research + cup_entry + multi-dept mastery | rare title, **mentor** privileges (see §7.5) |
| **Doctorate** (planned) | legend | capstone (§5.2) | unique title, named on a campus wall |

### 5.2 The Doctorate capstone (the "think big" apex)
A PhD should require a **novel, player-authored contribution** — the perfect tie-in to GrowPod's
**generative genetics** moat: e.g. *stabilize an original strain to a defined phenotype across N
generations and document it*, or *win a Cup with a line you bred*. The "dissertation" is the
strain's lineage record. This makes the highest credential a **showcase of the game's deepest system**,
not just more seat-time. (Design-level only; no implementation here.)

### 5.3 Why a ladder (not just degrees)
Degrees are **weeks** of investment — too sparse to drive a *daily* habit. The badge/certificate layer
provides the **frequent, legible wins** (Khan's badge taxonomy lesson) that carry a player *between*
degree milestones. Frequent small credentials → daily return; rare large credentials → long-term goals.

---

## 6. DELIVERABLE 5 — Reward structure

Three reward currencies, **carefully bounded by the faucet/sink invariant** (engagement must not
inflate the economy). Note: **no monetization/token design here** — out of scope by directive.

### 6.1 The reward taxonomy
| Reward | What it is | Source | Economy posture |
|---|---|---|---|
| **Knowledge XP (KXP)** | a *separate* XP pool earned only by learning | lessons, quizzes, mastery raises, reviews | **Non-economic** — drives levels/leagues, **cannot be spent**; can't be farmed in the grow. Prevents pay/grind-to-mastery. |
| **Course Perks** | the *real* permanent gameplay bonuses | course/degree completion (existing) | Already net-deflationary (perks/XP, **no GROW faucet**). Unchanged. |
| **Cosmetics & Titles** | profile flair, campus skins, title strings | badges, degrees, ceremonies | Pure cosmetic → zero inflation; strong identity/status pull (SDT relatedness). |
| **Streak Insurance** | streak freezes (earned, not bought here) | earned by consistency / review | A *retention* tool, not currency. |

> **Invariant call-out:** Knowledge XP is deliberately a **closed, non-economic pool**. It buys
> *status and progression*, never GROW. This keeps the engagement engine from becoming a faucet and
> keeps "you cannot buy mastery" true. The only thing that touches the real economy is **tuition (a
> sink)** and **perks (deflationary)** — both already shipped.

### 6.2 Reward cadence (variable + goal-gradient)
- **Per exercise:** instant correctness feedback (the smallest dopamine unit).
- **Per lesson:** KXP + streak credit + a progress-bar tick that **accelerates near a module's end**.
- **Per module:** a **badge** (named, flavored) — the frequent legible win.
- **Per course:** the **perk** + certificate + a Professor "well done" beat.
- **Per degree:** a **graduation ceremony** (§8.3) + title + cosmetic.
- **Surprise (variable):** occasional **bonus KXP** ("perfect lesson," "comeback after a freeze," "first
  try on a hard diagnose"), and a daily **double-or-nothing**-style optional wager of *KXP only*
  (never economy) to add variable-reward spice without risk to real assets.

### 6.3 Mapping rewards to motivators (so the structure is intentional)
| Motivator (SDT) | Mechanic |
|---|---|
| **Competence** | mastery ladder, badges, perks that visibly improve your grow |
| **Autonomy** | electives, choose-your-major, recommended-but-not-forced path |
| **Relatedness** | leagues, Dean's List, mentor/teaching privileges, alumni status |
| **Purpose** | "this knowledge makes your real grow better" — the perks *are* the proof |

---

## 7. DELIVERABLE 6 — Daily engagement systems

The retention engine. **All of it honors honesty-and-trust** (`04-honesty-and-trust.md`): encourage,
don't manipulate; protect streaks, don't weaponize them.

### 7.1 Daily goal + streak (the core habit)
- **Daily KXP goal**, player-set difficulty (Casual/Regular/Serious/Intense — Duolingo's proven menu).
- **Streak** = consecutive days meeting the goal. Visible counter; milestone celebrations (7/30/100/365).
- **Streak Freeze** — **earned** (not purchased here): e.g. one freeze granted per N-day streak, plus a
  weekend grace. Freezes are explicitly a **churn-prevention** tool, framed honestly ("we saved your
  streak"), never a guilt lever.
- **Repair window** — a short post-miss window to recover a streak with a quick review session
  (turns a lapse into a *re-engagement*, the opposite of shame).

### 7.2 Daily quests / "Today at GrowPod"
A small rotating board of 2–3 daily tasks (Duolingo daily-quests model), each a *learning* action:
- "Finish 1 lesson in your major."
- "Review a skill that's drifting." (spaced-repetition hook)
- "Diagnose 3 leaves correctly."
- "Check in on your live practical."
Completing the set tops up KXP and feeds the streak.

### 7.3 Spaced-repetition review queue
A **due-for-review** queue surfaces modules whose **mastery has decayed**. This is the system that
makes the player *retain* cultivation knowledge long-term and gives veterans a daily reason to return
even after "finishing." It also quietly reinforces real horticultural facts over months.

### 7.4 Leagues (weekly competition, bracketed)
- Weekly **KXP leagues** (Bronze → Silver → Gold → … → Diamond), ~20–30 players per bracket,
  **promotion/relegation**.
- **Bracketed by level/cohort** so veterans can't camp beginner boards (anti-toxicity guard from §1.6).
- Because the currency is **Knowledge XP** (not economy), leagues reward *learning effort*, not wallet
  size — fair by construction.

### 7.5 Social / relatedness layer (light, optional)
- **Dean's List / honor roll:** seasonal recognition for top learners (ties to Cup standing —
  `05-events-and-competition.md`).
- **Mentor / TA privileges:** Master/Doctorate holders can **endorse** or leave a tip on another
  player's grow — turns the most-educated players into *teachers*, closing the SDT relatedness loop and
  feeding the grower-reputation economy hinted at in `03-grower-skills.md`.
- **Study groups / cohorts** (stretch): shared streak goals — relatedness as a retention multiplier.

### 7.6 Notifications & re-engagement (honest version)
- **Helpful, not nagging:** "Your VPD skill is drifting — 3-min review?" or "Your practical harvest is
  ready to prove a course." Tied to *real, useful* state, not manufactured FOMO. Frequency-capped.
  This is the trust-preserving inversion of Duolingo's guilt notifications.

### 7.7 Engagement cadence summary
| Cadence | Hook |
|---|---|
| **Per session** | recommended-next node, a 3-min lesson, instant feedback |
| **Daily** | daily goal, streak, daily quests, review queue |
| **Weekly** | league promotion/relegation, Dean's List refresh |
| **Per course/degree** | perks, certificates, graduation ceremony |
| **Seasonal** | honors, Cup tie-ins, limited campus cosmetics |
| **Long-term** | mastery decay/refresh, Doctorate capstone, alumni status |

---

## 8. DELIVERABLE 7 — Recommendations for GrowPod University

### 8.1 The unifying thesis
**Make a 3-minute daily habit that compounds into real cultivation mastery and a real in-game edge.**
GrowPod's unfair advantage over Duolingo/Khan is that **the curriculum is the game**: a lesson on VPD
literally makes your next harvest better. Lean all the way into that — *every* learning reward should
visibly improve the player's grow, and *every* grow action should have a course that explains it.

### 8.2 Top recommendations (priority-ordered, design-level)
1. **Adopt the four-level hierarchy** (Course → Module → Lesson → Exercise) so the existing courses gain
   a **3–6 min daily loop**. Today a "course" is too coarse to be a daily habit; modules/lessons fix it.
2. **Split out Knowledge XP as a non-economic pool** powering levels/streaks/leagues — the cleanest way
   to add Duolingo-grade engagement **without** touching the economy invariant.
3. **Ship the badge/certificate ladder** beneath degrees for *frequent legible wins* between the sparse
   degree milestones.
4. **Build the two-clock UI** (Coursework bar + Practical bar) so daily knowledge progress is decoupled
   from grow-time practicals — this is what lets us have a daily streak honestly.
5. **Implement mastery decay + a review queue** (Khan model) so long-term players keep returning and
   actually *retain* the horticulture. This is the retention sleeper hit.
6. **Streak + freeze + repair, framed honestly** — the single biggest return driver, done in line with
   the trust doctrine (protect streaks, never weaponize them).
7. **Bracketed Knowledge-XP leagues** for competition that's fair by construction.
8. **Reserve the Doctorate as a generative-genetics capstone** — make the apex credential showcase the
   game's deepest moat system.
9. **Turn graduates into teachers** (mentor/TA privileges) to feed relatedness + the reputation economy.

### 8.3 The graduation system (the ceremonial payoff)
Graduation should be a **felt moment**, not a toast:
- **Ceremony scene:** the AI Professor confers the degree by name; the title is "pinned" to the profile
  with a short personalized citation ("for a stabilized line and a 92-quality harvest").
- **Diploma artifact:** a keepable, shareable diploma in the trophy case (the planned **Diploma NFT** is
  the *on-chain* version — explicitly **out of scope** for this research per directive; noted only as
  the future home of this artifact).
- **Alumni status:** permanent campus recognition; name on a wall for Master/Doctorate.
- **Commencement unlocks:** graduating opens the *next* track's spine (goal-gradient into the next arc),
  so a ceremony is both a *capstone* and an *on-ramp*.

### 8.4 THINK BIG — the best cannabis-education platform in gaming
If GrowPod University were the category's best, it would be:
- **A real curriculum disguised as a game** — a player finishes the Bachelor track and could *actually
  hold a better grow conversation*, because the content is grounded in NMU/CSU-Pueblo/Cornell/Penn-State
  material (already true of the source curriculum).
- **A daily-habit learning app** with Duolingo-grade streaks/leagues/quests, where the "lessons" teach
  cannabis science and the "practice" is a living simulated grow.
- **A mastery engine, not a checkbox** — Khan-style mastery + decay means knowledge is *kept*, and the
  Professor adapts.
- **An identity ladder** — badges → certificates → degrees → titles → alumni wall → Doctorate, so
  *who you are* in GrowPod is visibly *what you've learned*.
- **A teaching community** — the most-educated players mentor newcomers, and the Cup is where the
  University's best prove it.
- **The moat's earned-mastery half, fully realized** — knowledge earned over real time, proven in a
  real grow, that you *cannot buy* — exactly the GROWv2 north star.

### 8.5 Open design questions for the owner (decisions, not blockers)
- **Streak stakes:** how forgiving? (Recommend generous — freezes + repair window — per trust doctrine.)
- **Knowledge XP visibility vs. player level:** one unified level, or a parallel "Academic Level"?
  (Recommend a **parallel Academic Level** so learning has its own identity and can't be bought with
  grow-grinding.)
- **League opt-in:** default-on (Duolingo) vs. opt-in (gentler)? (Recommend default-on but quietly
  hideable.)
- **How aggressive is mastery decay?** (Recommend gentle: one tier over weeks, fully restorable in one
  review — retention without punishment.)

---

## 9. Source map (what grounded this research)
- **Engagement mechanics:** documented public behaviour of **Duolingo** (paths, daily goal, streaks +
  freeze, leagues, crowns/legendary, practice/SRS), **Codecademy** (career/skill paths, learn-by-doing,
  projects/portfolio, progress %), **Khan Academy** (mastery levels + decay, knowledge map, mastery
  points, course challenge / test-out, badge taxonomy).
- **Learning science:** spaced repetition (Ebbinghaus forgetting curve), mastery learning (Bloom),
  Self-Determination Theory (Deci & Ryan: autonomy/competence/relatedness), goal-gradient + variable
  reward, loss aversion.
- **GrowPod internal grounding (do not contradict):** `docs/memory/design/06-university.md`,
  `docs/research/2026-06-08-cannabis-education-curriculum.md`, `src/growpodempire/data/curriculum.yaml`,
  `docs/memory/design/00-game-vision.md` (the moat), `03-grower-skills.md`, `04-honesty-and-trust.md`,
  `05-events-and-competition.md`, and `CLAUDE.md` invariants (DB-authoritative, faucet/sink, CI-safe AI,
  earned-not-bought mastery).

---

## 10. DIRECTIVE REPORT (UNI-001)

**Directive ID:** UNI-001
**Lead Agent:** UNI-A00
**Worker Agent:** UNI-A01

**Asked:** Research and design the complete educational structure for GrowPod University — a
progression/engagement architecture that teaches real cannabis cultivation while feeling like a game
(research only; no code, no Phase-1 features, no monetization, no tokens).

**Done:** Delivered a full curriculum-architecture research document covering all 7 deliverables —
(1) a four-level course hierarchy (Course→Module→Lesson→Exercise) with Beginner/Intermediate/Advanced
tracks over the existing 6→9 departments; (2) module breakdowns with a 5-beat learning-loop arc and a
worked example; (3) the 3–6-min lesson loop, exercise types, unlock gates, the two-clock
(knowledge/practical) decoupling, and a recommended-next anti-paralysis engine; (4) a micro-credential
ladder (Badge→Certificate→Specialization→Degree→Doctorate) wrapping the existing 5 degree tiers; (5) a
bounded three-currency reward structure with Knowledge XP as a **non-economic** pool that honors the
faucet/sink invariant; (6) daily-engagement systems (goal, streak+freeze+repair, daily quests,
spaced-repetition review queue, bracketed KXP leagues, mentor/social layer, honest notifications); and
(7) prioritized recommendations + a graduation/ceremony system + a THINK-BIG vision. Grounded in
Duolingo/Codecademy/Khan Academy mechanics and learning science, and reconciled with the existing
GrowPod university content and all `CLAUDE.md` invariants.

**Risks:** This is the *engagement* layer over an *existing* content system — implementation (out of
scope) must reuse existing gating primitives (`prereqs`/`level_req`/practicals/`duration_hours`) rather
than inventing parallel paths, or it risks two sources of truth. Knowledge-XP must stay a closed,
non-economic pool or it becomes an inflation faucet. Streak/notification mechanics must follow the
honesty-and-trust doctrine or they erode player trust.

**Needs You:** Four design decisions (all have recommendations in §8.5): streak forgiveness level;
unified vs. parallel "Academic Level"; league default-on vs. opt-in; mastery-decay aggressiveness.
None block consolidation into the Master Bible.

**Next:** Submit to Records (UNI-A10) for consolidation into the **GrowPod University Master Bible**.
A future *implementation* directive (explicitly out of scope here) would sequence: module/lesson data
schema → Knowledge-XP pool → two-clock UI → badge ladder → streak/daily systems → review queue →
leagues.

**Observations:** GrowPod's structural edge over generic edtech is that **the curriculum is the game** —
a learned concept literally improves the next harvest. Recommend every engagement mechanic lean into
that linkage. The existing system already nails the *content* and the *earned-mastery* moat; this
directive supplies the missing *daily-habit retention engine* to sit on top of it.

**Recommendation:** Adopt the four-level hierarchy + Knowledge-XP pool + two-clock UI as the
foundational trio — they unlock Duolingo-grade daily engagement without touching the economy or the
earned-mastery invariant, and everything else (badges, streaks, leagues, ceremonies) layers cleanly on
that base.

**Blocked:** Nothing.

*Generated 2026-06-14 under Directive UNI-001 (research only). For consolidation by Records (UNI-A10)
into the GrowPod University Master Bible.*
