# bio-101 Assessment Item Bank — deterministic, data-authored (F3)

> **Records/content only** (UNI-011 freeze-safe). The **authored, objectively-gradable** assessment
> items for `bio-101`, so grading is **pure and CI-safe** — never needs a live AI to grade (Phase-2
> §5, Master Report §7.2). This is the content that makes Build-Phase 1 buildable. Items are written
> in a neutral data shape that maps directly into `curriculum.yaml` later. Faculty feedback voice:
> Professor Flora. Status: **draft / seed bank.**

## Grading contract (the CI-safety rule)
Every item has a **machine-checkable answer key**. Supported types + deterministic graders:
- `mcq` — single correct index. · `multi` — exact set match. · `tf` — boolean.
- `numeric` — correct value **+ tolerance** (e.g. `±5`). · `drag_sort` — correct ordering/pairing.
No item requires free-text AI grading. Explained feedback is **authored per item** (shown on submit).
**Gates:** Midterm ≥ 70% (unlocks M3–M4) · Mastery ≥ 80% (Badge). Retryable/forgiving (§7.3).

## Item shape (illustrative schema)
```yaml
- id: m1-kc-1
  module: m1
  type: mcq
  stem: "…question…"
  choices: ["…", "…", "…", "…"]
  answer: 1                 # 0-based; for multi: [0,2]; numeric: {value: 700, tol: 100}
  explain: "…why, in Professor Flora's voice…"
  objective: 1             # maps to §17.0 course objectives
```

---

## Module 1 — Cells & Tissues (knowledge checks)
```yaml
- id: m1-kc-1
  type: mcq
  stem: "Your plant wilts at the end of a hot day, then recovers after watering. Which structure's loss of pressure best explains the wilting?"
  choices: ["The cell wall", "The vacuole (turgor)", "The nucleus", "The chloroplast"]
  answer: 1
  explain: "The vacuole is the cell's water store; losing turgor pressure is what makes a thirsty plant lose its 'skeleton' and droop."
  objective: 1
- id: m1-kc-2
  type: drag_sort         # pair tissue → function
  stem: "Match each tissue to its job."
  pairs:
    dermal: "outer skin / cuticle / stomata"
    vascular: "transport (xylem & phloem)"
    ground: "bulk, storage, photosynthesis"
    meristematic: "growth zone (dividing cells)"
  answer: exact_pairing
  explain: "Four tissue systems; the meristem at each tip is where new growth actually happens."
  objective: 1
- id: m1-kc-3
  type: tf
  stem: "Topping a plant removes the apical meristem and releases lower branches from apical-dominance suppression."
  answer: true
  explain: "The shoot tip chemically suppresses laterals; remove it and side shoots compete — cell biology you can do with scissors."
  objective: 1
- id: m1-scenario
  type: mcq
  stem: "A clone won't root and shows no new growth at the tip. Which tissue is most relevant to diagnose first?"
  choices: ["Dermal", "Meristematic", "Ground", "Vascular"]
  answer: 1
  explain: "No new tip growth points at the apical meristem — the dividing-cell zone responsible for new growth."
  objective: 1
```

## Module 2 — Photosynthesis & Energy (knowledge checks)
```yaml
- id: m2-kc-1
  type: mcq
  stem: "Three inputs must show up together for photosynthesis. Which set?"
  choices: ["Light, nitrogen, water", "Light, CO2, workable temperature", "CO2, phosphorus, oxygen", "Light, humidity, calcium"]
  answer: 1
  explain: "Light, CO2, and temperature form the trio; starve one and the others can't carry the load."
  objective: 2
- id: m2-kc-2
  type: numeric
  stem: "On the assimilation curve you explored, above the light-saturation point, each extra unit of PPFD adds approximately how much additional sugar (relative %)?"
  answer: {value: 0, tol: 5}
  explain: "Past saturation the curve is flat — roughly zero extra gain, and beyond it you risk light/heat stress."
  objective: 2
- id: m2-kc-3
  type: mcq
  stem: "Raising CO2 (within reason) does what to the light-saturation point?"
  choices: ["Lowers it", "Removes it", "Raises it (more light now pays off)", "No effect"]
  answer: 2
  explain: "More CO2 moves saturation higher, so additional light becomes useful again — the next limiting factor shifted."
  objective: 2
- id: m2-scenario
  type: mcq
  stem: "A grower doubled wattage; growth didn't improve and leaf-tip bleaching appeared. Best single description?"
  choices: ["Nutrient lockout", "Past light saturation / light stress", "Overwatering", "Phosphorus deficiency"]
  answer: 1
  explain: "Bleaching at the top with no growth gain = light past saturation (heat usually riding along)."
  objective: 2
```

## Module 3 — Water, Nutrients & Transport (knowledge checks)
```yaml
- id: m3-kc-1
  type: mcq
  stem: "What primarily drives the upward movement of water and minerals in the xylem?"
  choices: ["Root pressure pushing", "Transpiration pulling from the leaves", "Phloem sugar flow", "Gravity"]
  answer: 1
  explain: "Transpiration is the pump: water leaving the leaf pulls the whole column up behind it."
  objective: 3
- id: m3-kc-2
  type: mcq
  stem: "Push VPD too high and the plant slams its stomata shut. What's the feeding consequence?"
  choices: ["Faster uptake", "The transpiration pump stops, so uptake/feeding stops", "More CO2 intake", "Nothing"]
  answer: 1
  explain: "Closed stomata = pump off; a plant in perfect nutrients can starve with its mouth shut."
  objective: 3
- id: m3-kc-3
  type: mcq
  stem: "A MOBILE-nutrient deficiency (e.g. magnesium) appears first on which leaves?"
  choices: ["New top growth", "Lower, older leaves", "Only the stem", "Evenly everywhere"]
  answer: 1
  explain: "The plant cannibalizes old leaves to feed new growth, so mobile deficiencies show low and old."
  objective: 3
- id: m3-kc-4
  type: multi
  stem: "Select the MOBILE nutrients (shown low/old when deficient)."
  choices: ["Nitrogen", "Calcium", "Magnesium", "Iron", "Potassium"]
  answer: [0, 2, 4]
  explain: "N, Mg, K (and P) are mobile; Ca and Fe are immobile and show on new growth."
  objective: 3
```

## Module 4 — Environmental Response & Integration (knowledge checks)
```yaml
- id: m4-kc-1
  type: mcq
  stem: "Interveinal chlorosis on LOWER leaves, healthy top. Most likely cause and logic?"
  choices: ["Iron (immobile, new growth)", "Magnesium (mobile, old growth)", "Overwatering", "Light stress"]
  answer: 1
  explain: "Lower/old + interveinal = mobile-nutrient logic = magnesium; the SAME pattern up top would suggest iron."
  objective: 4
- id: m4-kc-2
  type: tf
  stem: "Leaf-edge cupping/'tacoing' with bleaching at the very top is consistent with combined heat + light stress."
  answer: true
  explain: "Light and heat stress travel together; check whether damage is worst directly under the lamps."
  objective: 4
- id: m4-kc-3
  type: mcq
  stem: "First question to cut a deficiency diagnosis in half?"
  choices: ["What nutrient brand?", "Bottom/old or top/new?", "What strain?", "What week?"]
  answer: 1
  explain: "Location (bottom-old vs top-new) splits mobile from immobile before you ever name the nutrient."
  objective: 4
```

---

## Midterm (covers M1–M2 · 12 items · ≥70% gate) — sample blueprint
- 6 MCQ (3 per module), 2 TF, 1 numeric (saturation), 1 drag-sort (tissues), 2 scenario-MCQ.
- **Sample gate item:** *"Which limits growth first when all else is ample but light is at saturation?"*
  → choices `[more light, the next limiting factor ✓, respiration, chlorophyll]`, `answer: 1`.

## Mastery Exam (all 4 modules · 20 items · ≥80% → Badge) — blueprint + sample
- ~5 items/module, mixed types; comprehensive; retry after cooldown.
- **Sample:** *"A lower leaf shows interveinal chlorosis; upper growth is fine. Most likely cause and
  why?"* → MCQ, `answer:` Mg (mobile-nutrient logic), with an explained-feedback reveal.

## Authoring rules (so the bank stays CI-safe & fair)
1. One unambiguous key per item; distractors plausible but clearly wrong on the taught logic.
2. Numeric items always carry a tolerance. 3. Explained feedback teaches, never just "wrong."
4. No trick wording; objective-tagged for coverage. 5. Bank > exam size so exams can sample/rotate.
6. All keys live in data → grading is a pure function (mirrors the shipped practical checks).

## Cross-links
- Course/spec: `docs/research/UNI-001-v2-Master-Report.md` §7, §17 · scripts: `bio-101-lecture-scripts.md` (B2)
- Deterministic-grading standard: `docs/memory/design/07-university-phase-2.md` §5
- Master plan/ledger: `docs/research/university/IMMERSIVE_UNIVERSITY_MASTER_PLAN.md`
