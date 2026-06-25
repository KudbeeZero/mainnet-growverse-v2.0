# bio-101 "Foundations of Plant Biology" — Full Narration Scripts (B2)

> **Records/content only** (UNI-011 freeze-safe). The **complete, transcript-ready narration scripts**
> for the canonical exemplar course `bio-101`, authored to the Master Report §17 standard (which gives
> the outline + excerpts only). These are the word-for-word **lecture transcripts** that the shipped
> ElevenLabs narration pipeline voices (and the B1 avatar-video layer lip-syncs). Faculty: **Professor
> Flora**. Part of the Immersive University pass (Track B). Status: **draft for owner review.**
>
> **✅ Roster RESOLVED (2026-06-25, Phase 0 build):** `bio-101` ("Foundations of Plant Biology") is
> taught by **Professor Flora** in the **cultivation** department, which maps to Rachel
> (`EXAVITQu4vr4xnSDxMaL`) in `ai/elevenlabs_narrator.py` `_DEPT_VOICES`. The stray §17.11
> `vera-lindqvist` manifest entry is superseded — code is authoritative. Scripts below are in Flora's
> voice and require no edit.

## How to read this
- Each voiced component = **one narration manifest row** (B1 / Master Report §15.2) → one cached MP3
  keyed on `(voice_id, text_hash)`. Editing a script bumps only that row's version and regenerates
  only that file.
- **The script IS the transcript** (accessibility parity, Phase-2 §10). Captions are the timed layer
  over this text (ElevenLabs timestamps / forced alignment, B1 §3).
- Honest-hour: the spoken minutes below are the *narrated-lesson* slices of each module's budget
  (§17.1); video, labs, checks, and scenarios carry the rest. Spoken word counts target ~130 wpm.
- Tone (Professor Flora): warm, plain-spoken, grower-practical; every concept lands on "what you'll
  see in your grow." No hype, no fluff.

---

## Lesson `orientation-intro` — Orientation (narration, ~3.5 min spoken within the 12-min component)

*"Welcome. I'm Professor Flora, and before you ever touch a nutrient bottle or a pair of scissors,
we're going to understand the thing you're actually growing. A cannabis plant is not a machine with
inputs and outputs — it's a living chemistry set that's been solving one problem, turning light into
matter, for four hundred million years. Treat it like a machine and it will surprise you. Understand
it as an organism and it will tell you, in advance, almost everything it's about to do.*

*Here's how the next four hours go. We start small — at the cell — because every problem you'll ever
diagnose, every yellow leaf and slow root and bleached top, is a story about something happening
inside cells. Module one: cells and tissues, the parts list and what each part is for. Module two:
photosynthesis and energy — how light becomes sugar, and the surprising truth that more light is not
always more growth. Then a short midterm, just to make sure the foundation is solid before we build
on it. Module three: water and nutrients — the plumbing, the pump, and why every serious grower ends
up obsessed with a number called VPD. Module four: how the whole plant responds to stress, where we
put it all together and you diagnose a sick plant end to end.*

*Then you prove it. Not on paper — in a grow. The capstone puts you in a Virtual Grow Room to run a
seedling up to a healthy vegetative plant, and to finish the course for real, you'll resolve an
actual issue in your own live grow. That's the whole philosophy of this university: the classroom
teaches, the grow proves. Knowledge here is earned, never bought.*

*One promise before we start. By the end of this course, when a leaf yellows in your grow, you won't
guess. You'll look at which leaf, where on the leaf, and how fast — and you'll know why. Let's begin.
First, a quick, ungraded check of what you already know. Don't worry about the score; it just helps
us tune what to review with you later."*

> Component also includes: 6 orientation slides (§17.2) and a 5-question ungraded pre-assessment
> (primitive #11, no gate). Accessibility: transcript visible, narration pausable, pre-assessment
> keyboard-navigable.

---

## Lesson `m1-narrated-lesson` — Module 1: Cells & Tissues (narration, ~12 min component)

*"Let's open up a single plant cell, because almost everything that matters to you as a grower starts
right here. Click the cell wall first — that rigid outer box. Animal cells don't have it; plant cells
do. It's what lets a plant stand up without a skeleton, and it's made largely of cellulose, the
single most abundant building material life makes.*

*Now the big one. See that enormous compartment taking up most of the volume — the vacuole? Think of
it as a water balloon under pressure. That pressure has a name, turgor, and it's structural. When
your plant wilts at the end of a hot day, this is what's deflating. A thirsty plant literally loses
its skeleton. Rehydrate it and watch it stand back up within the hour — that's turgor returning. So
the very first thing the cell teaches you is that 'droopy' is not a mood; it's a pressure reading.*

*Click the green ovals — the chloroplasts. This is where light becomes sugar, and we give it the
whole of module two, so for now just file it away: the green you see in a healthy leaf is millions of
these, and when a leaf goes pale, it's often these thinning out. The nucleus is the cell's instruction
set; it holds the genetics — the same genome you're buying when you choose a strain, expressed cell by
cell. And the membrane around everything is the gatekeeper, deciding what comes in and what stays out.
Most of nutrient uptake is really a story about membranes doing their job.*

*Now zoom out from one cell to tissues — cells of the same kind working together. There are four you
should know by name. Dermal tissue is the plant's skin: the outer layer, the waxy cuticle, and on the
leaf underside, the tiny adjustable mouths called stomata that we'll meet again in water and in
photosynthesis. Ground tissue is the bulk — storage, support, and a lot of the photosynthesis. Vascular
tissue is the plumbing, two pipes running the length of the plant, and we devote module three to it.*

*And then the one that quietly runs your whole grow: meristematic tissue. Meristem is the plant's
growth zone — undifferentiated cells that keep dividing, found at the very tip of every shoot and the
very tip of every root. The shoot tip is the apical meristem, and it's the boss. It releases a signal
that tells the side branches to hold back — that's apical dominance, why an untopped plant often runs
one tall central cola. The moment you top a plant, you remove that boss, and the side shoots are freed
to compete. You just used cell biology to change the shape of your plant. Hold onto that idea —
everything you do as a grower is, underneath, an edit to what these cells are doing. In the lab next,
you'll identify these structures yourself under a virtual microscope."*

> Lab 1 hint scripts (`m1-lab1-hint-*`) and the clickable-diagram callouts are separate short manifest
> rows in Flora's voice. Accessibility: every micrograph alt-texted; drag-drop has a keyboard
> equivalent; color never the sole cue.

---

## Lesson `m2-narrated-lesson` — Module 2: Photosynthesis & Energy (narration, ~12 min component)

*"In module one I promised we'd come back to those green ovals. Here we are. Photosynthesis is the
deal at the center of the whole plant: light comes in, and sugar comes out — the food the plant builds
everything else from. Let me give it to you the way it actually matters on the grow-room floor.*

*Light hits pigments inside the chloroplast and gets turned into chemical energy — that's the 'light
reaction.' That energy is then spent assembling carbon dioxide from the air into sugar — the 'dark
reaction,' though it's not fussy about the dark; it just doesn't need light directly. So three things
have to show up together: light, carbon dioxide, and a workable temperature. Starve any one of them
and the other two can't carry the load. Remember that — it's the whole game.*

*Look at the before-and-after slider. On the left, a leaf in dim light: slide up and assimilation —
the rate of sugar-making — climbs fast. More light, more sugar. Intuitive. But keep sliding. Watch
what happens. The curve bends over and flattens. There's a point — we call it light saturation — where
cramming more photons at the leaf stops buying you sugar. The machinery is already running flat out;
the extra light has nowhere to go. And past that point it doesn't just stop helping — it starts doing
harm. That bleached, almost white look at the top of an over-lit plant? That's light past saturation,
with heat usually riding along.*

*This is the single most expensive misunderstanding in indoor growing, so let me say it plainly. Your
job is not 'more light.' Your job is 'enough light — then go fix the next thing that's actually
limiting growth.' Maybe that next thing is carbon dioxide; if you raise CO₂, you actually move the
saturation point higher, and now more light pays off again. Maybe it's temperature, or water, or a
nutrient. There's an old idea called Liebig's barrel: a barrel made of staves of different heights
only holds water up to its shortest stave. Growth works the same way — it's capped by whatever is most
limiting, and adding more of something that isn't the limit does nothing. We'll meet that barrel again
in nutrients.*

*One more piece: respiration. All day the plant banks sugar; at night, and in every living cell around
the clock, it spends some of that sugar to run itself — that's respiration, the reverse trade, sugar
back into energy. It's why night temperature matters, and why a plant is quietly working even with the
lights off. In the simulator next, you'll find the saturation point yourself, and then prove you can
move it by changing CO₂. Don't just hit the target — notice the shape of the curve. That shape is a
mental model you'll use for the rest of your growing life."*

> Lab 2 (Photosynthesis Simulator) hint scripts are separate rows. The assimilation curve is also
> provided as a data table (accessibility); slider values are announced.

---

## Lesson `m3-narrated-lesson` — Module 3: Water, Nutrients & Transport (narration, ~12 min component)

*"Every plant is running two one-way pipelines at once, and once you can see them, half of plant care
suddenly makes sense. Click the diagram. The xylem carries water and dissolved minerals up — roots to
leaves, one direction. The phloem carries the sugar made in the leaves down and out to wherever the
plant is building — new roots, new shoots, fattening flowers. Up-water, down-food. That's the whole
map.*

*Now, what drives the up-pipe? Here's the part that surprises people. It's not mostly the roots
pushing — it's the leaves pulling. Water evaporates out through those tiny stomata on the leaf
underside, and as each water molecule leaves, it tugs the entire connected column up behind it, all
the way down to the roots, dragging dissolved nutrients along for the ride. That evaporation is called
transpiration, and it isn't waste — it's the pump. No transpiration, no pump; no pump, no feeding.*

*Which brings us to the number serious growers obsess over: VPD, vapor pressure deficit. Don't let the
name scare you. VPD is just how thirsty the air is — how hard the air is pulling moisture out of the
leaf. Watch the before-and-after. When VPD sits in a comfortable band, the stomata stay open, the pump
runs smoothly, the plant transpires and feeds and grows. Push VPD too high — air too hot, too dry —
and the plant does the one thing it must to survive: it slams its stomata shut to stop losing water.
Sensible for survival. But now the pump is off. Transpiration stops, uptake stops, and a plant
surrounded by perfect nutrients can sit there starving with its mouth closed. Push VPD too low — air
cold and soggy — and the plant can barely transpire at all, growth crawls, and standing moisture
invites mold. This is why we don't just set temperature or just set humidity. We tune them together,
to land VPD in the band — and your grow's sim already computes leaf-level VPD for you.*

*Last piece, and it's the one that lets you read a sick plant like a page of text: nutrient mobility.
Some nutrients are mobile — the plant can pull them back out of an old leaf and ship them, through the
phloem, to new growth when supply runs short. Nitrogen, magnesium, potassium, phosphorus are the
mobile crew. When they're deficient, the plant cannibalizes its oldest, lowest leaves first to feed
the top — so a mobile-nutrient shortage shows up low and old. The immobile nutrients — calcium, iron,
and others — can't be moved once placed, so when they run short it's the new growth at the top that
suffers first, while the old leaves look fine. So before you ever name the nutrient, ask one question:
is the problem on the bottom of the plant or the top? Bottom and old says mobile. Top and new says
immobile. You've just cut the diagnosis in half before touching a chart. In the lab you'll hold a VPD
band by steering temperature and humidity; in module four you'll use this top-versus-bottom logic to
diagnose real deficiencies."*

> Lab 3 (Environmental Variables) reuses the engine's derived leaf-VPD in teaching mode. VPD readouts
> numeric + announced; the xylem/phloem diagram is fully keyboard-labelable.

---

## Lesson `m4-narrated-lesson` — Module 4: Environmental Response & Whole-Plant Integration (narration, ~11 min component)

*"Everything to this point has been parts. This module is the assembly — because a plant doesn't
experience cells and pipes and curves. It experiences one situation at a time and responds as a whole
organism. Let me show you how the pieces you already have lock together, and then you're going to
diagnose three sick plants yourself.*

*Start with the principle: every symptom is a story about a process you now understand. A plant under
stress doesn't have many ways to talk to you, so it reuses the same signals — color, posture, the
location of damage, the speed of change. Your job is to read those signals back to the process. Walk
through the common stresses with me. Drought: stomata close to save water, the pump from module three
stutters, turgor from module one drops, and you see wilting and stalled growth. Heat, often arriving
with strong light: you may see leaf edges cupping or 'tacoing' and, at the very top, that bleaching we
named in module two — light and heat past saturation. Light stress and heat stress travel together, so
always check whether the damage is worst directly under the lamps.*

*Now nutrients, using the tool from module three. Picture interveinal chlorosis — yellowing between
the veins while the veins stay green. If it's on the lower, older leaves, mobility tells you the plant
is robbing its old growth to feed the new: that's a mobile nutrient, magnesium being the classic. If
that same pattern showed up on the new top growth instead, you'd suspect an immobile nutrient like
iron, and your fix would be different. Same symptom, opposite cause, and the only thing that told them
apart was where on the plant it appeared. That's not memorization — that's the model doing the work.*

*Here's the mental model I want you to leave with. Light and CO₂ set the ceiling on how much sugar the
plant can make. Water and the transpiration pump decide whether that machinery can actually run and get
fed. The cell's turgor and tissues turn it all into a standing, growing structure. And the meristem at
each tip spends the proceeds on new growth, under rules you can change with a pair of scissors. When
one of those layers is off, the plant tells you — through the exact channels we've studied. In the
clinic next, you'll meet three plants in trouble. For each one, don't jump to a product. Read the
signal, name the process, then choose the first intervention. Cause before cure. That habit, more than
any single fact, is what separates a grower who reacts from a grower who knows."*

> Lab 4 (Stress Diagnosis Clinic) follows: 3 sick plants, identify cause AND first action on ≥2/3.
> Reflection checkpoint (primitive #10) closes the module. Symptom images alt-texted; no color-only
> diagnosis.

---

## Lesson `cert-congrats` — Certification (narration, ~1.5 min)

*"Congratulations. You've earned the Plant Biology Foundations badge — and you earned it the only way
this university gives anything: by understanding it and proving it in a grow. Take a second with what
changed. You started seeing a plant as inputs and outputs. You're leaving able to look at a single
leaf — which one, where, how fast — and read the process behind it. That's not a small thing. That's
the difference between following a feeding schedule and actually growing.*

*This is the foundation the rest of the curriculum stands on. Cultivation systems, genetics, nutrients,
chemistry — every one of them will lean on what you just built here, the cell, the energy economy, the
pump, the whole-plant model. Your diploma's on your transcript wall, and your grow is waiting. I'll see
you in the next class. Keep reading your plants."*

---

## Authoring notes & open items (owner)
- **Voice/faculty:** resolve the Flora-vs-Vera-Lindqvist discrepancy (top of doc) and assign `bio-101`
  a department→voice row in `_DEPT_VOICES`.
- **Remaining voiced rows to author before build:** Lab 1–4 instruction/hint scripts, the per-slide
  clickable-diagram callouts, and the exam explained-feedback lines. The narrated *lessons* (the
  professor's lectures — the player-facing "really in class" core) are complete above.
- **Honest-hour:** these scripts populate the narrated-lesson slices of §17.1 (M1–M3 12 min each, M4
  11 min, orientation within 12 min). Video, labs, checks, scenarios, and exams carry the rest to 240.
- **Pipeline:** each `LessonID` here becomes one `(voice_id, text_hash)` cache row (B1); editing one
  script regenerates only that MP3.

## Cross-links
- Exemplar spec: `docs/research/UNI-001-v2-Master-Report.md` §17 · standards: `docs/memory/design/07-university-phase-2.md`
- Lecture video/voice pipeline: `docs/research/2026-06-23-ai-presenter-lecture-pipeline.md` (B1)
- Classroom surfaces (where these play): `docs/memory/design/08-immersive-classroom.md` (A2)
- Science grounding: `knowledge/plant-anatomy-reference.md` · `knowledge/whole-plant-architecture.md` ·
  `knowledge/environment-rules.md` · `docs/research/2026-06-14-growpod-university-science-curriculum.md`
- Master plan/ledger: `docs/research/university/IMMERSIVE_UNIVERSITY_MASTER_PLAN.md`
