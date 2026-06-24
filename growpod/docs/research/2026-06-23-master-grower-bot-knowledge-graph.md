# GrowVerse Master Grower Bot — Knowledge Architecture & Grounding (C1)

> **Records/Research only** (UNI-011 freeze-safe). Designs how the **GrowVerse Master Grower AI Bot**
> maps the game's entire knowledge corpus into a **retrieval + grounding layer** so it gives accurate,
> cited growing help and never hallucinates. Reuses the **already-shipped advisor stack**. Part of the
> Immersive University pass (Track C). Monetization is C2 (design only, no code). Status: **draft for
> owner review.**

## 1. Thesis
The bot's value — and its safety — is that it answers **only from GrowVerse's own verified knowledge
and the player's live grow**, with citations. RAG exists precisely to ground a model in verifiable
sources and cut hallucination; for a domain where a wrong number ruins a real grow, grounding is not
optional. The good news: **GrowVerse already owns a curated, structured corpus** — we don't scrape the
internet, we retrieve our own canon.

## 2. The three grounding sources (the knowledge the bot stands on)
| Source | Shape | Examples | Role |
|---|---|---|---|
| **A. Live game state** | structured (DB/sim) | plant stage, health, leaf-VPD/DLI/PPFD, `condition_flags`, deficiencies, recent events, genome | "the bot knows *your* plant" — the personalization moat |
| **B. Structured strain data** | machine-readable YAML | encyclopedia frontmatter for 29 strains (`thc_pct`, `terpenes`, `flowering_days`, `difficulty`, `indica_ratio`, lineage/parents, rarity) | exact factual lookup (proper nouns, numbers) |
| **C. Knowledge corpus** | prose + docs | 10 `knowledge/*.md` (botanical-bible, environment-rules, genetics-system, grow-tent-rules, plant-anatomy, whole-plant-architecture, strain-dna, mutation, macro-bud, procedural-gen), 29 encyclopedia prose bodies, the university curriculum + science research docs | conceptual "how/why" answers via RAG |

This split is the whole design: **structured facts are looked up (never summarized into error);
conceptual questions are retrieved and cited; the player's situation is read live.**

## 3. Retrieval design
- **Hybrid search** (semantic + keyword). Semantic embeddings find meaning ("why are my lower leaves
  yellowing"); keyword/BM25 is mandatory for **proper nouns, strain slugs, nutrient names, codes,
  numbers** (e.g. "Gelato", "Mg", "VPD", "58 days") where exact match matters and embeddings drift.
- **Chunking by authored section.** The corpus is already small and well-sectioned (each
  `knowledge/*.md` is a few KB with clear headings) — chunk on headings, carry metadata
  `{source_file, section, topic, strain_slug?}`.
- **Metadata filters.** A question about Gelato filters to `strain_slug: gelato` + general botany;
  a deficiency question filters to environment/anatomy/whole-plant docs.
- **Structured lookups bypass RAG.** Strain facts come from the **YAML frontmatter directly** (a typed
  lookup), not from prose retrieval — no chance of a summarized-wrong number.

## 4. Grounding & anti-hallucination discipline (the hard rules)
1. **Answer only from retrieved context + live state.** If the corpus doesn't cover it, the bot says
   "that's outside what GrowVerse has taught me" — it never free-associates cannabis advice.
2. **Cite every claim** to its source (`knowledge/environment-rules.md §VPD`, `encyclopedia/gelato`).
   Guard against *citation-shaped* hallucination (a real-but-irrelevant/outdated cite) — the cite must
   actually entail the claim.
3. **Grounding verification.** An NLI/faithfulness check (or a structured self-check) confirms the
   answer is logically inferrable from the retrieved chunks before it ships; low-confidence →
   hedge/defer, don't assert.
4. **Never invent numbers.** Quantities (PPFD, VPD bands, flowering days, THC%) come from structured
   source B or a cited doc, or aren't given.
5. **Live-state honesty.** When advising on the player's plant, the bot reads the real sim state via
   the existing advisor context — it can't claim a plant is healthy if `condition_flags` say otherwise.

## 5. Reuse the shipped advisor stack (don't rebuild)
The Master Grower **already exists** as a per-plant diagnostician:
- `ai/provider.py` — `AdvisorProvider` ABC + `AdvisorReport` (summary/severity/diagnosis/suggestions),
  with a constrained `CareAction` vocabulary (water/feed/treat_pests/treat_disease/adjust_environment/
  harvest/wait) that maps 1:1 to real API routes.
- `services/advisor_service.py` (builds the plant-state context), `ai/autocare.py` +
  `services/autocare_service.py` (guarded agentic auto-care), `ai/mock.py` (CI-safe), `ai/factory.py`
  (provider selection).

**The bot is an orchestration layer over this**, not a replacement. Design it as a
`MasterGrowerProvider` ABC + `MockMasterGrower` + `ClaudeMasterGrower` (mirrors the advisor/lecturer
pattern, CI-safe, **no key in CI**), exposing **tools** the model calls:
- `get_plant_state(plant_id)` → existing advisor context (source A)
- `lookup_strain(slug|name)` → encyclopedia frontmatter (source B)
- `search_knowledge(query, filters)` → hybrid retriever over the corpus (source C)
- `diagnose_plant(plant_id)` → the existing `AdvisorProvider.diagnose()` (reuse, don't duplicate)

So a conversation like *"why are my Gelato's lower leaves yellow and what do I do?"* becomes:
`get_plant_state` (sees lower-leaf chlorosis, stage, VPD) → `search_knowledge('interveinal chlorosis
lower leaves mobile nutrient')` (cites whole-plant-architecture + environment-rules) → `diagnose_plant`
(structured AdvisorReport) → grounded, cited answer mapped to real care actions.

## 6. Optional knowledge-graph layer (v2)
The corpus implies a graph worth materializing later: **entities** = strains, nutrients, deficiencies,
symptoms, growth stages, environment params, anatomy parts; **relations** = strain→lineage→parents
(already in frontmatter), deficiency→symptom→leaf-location→first-action, stage→ideal-VPD-band,
mobile/immobile→where-it-shows. This graph would (a) power deterministic diagnosis reasoning, (b) feed
the Anatomy Explorer labels (A2), and (c) let the bot answer structurally ("show Gelato's parents").
**Recommendation: ship RAG-over-corpus as v1; build the graph as v2** once the corpus is stable.

## 7. Freshness, versioning, CI-safety
- **Re-embed only changed chunks**, keyed on a content hash — the same regenerate-only-on-change
  discipline the narration pipeline already uses (`text_hash`). Corpus edits are cheap.
- **CI-safe**: `MockMasterGrower` returns deterministic, pre-grounded canned answers; the retriever has
  a mock backend; **no embedding/LLM key required in CI** (matches `ai/factory.py` convention).
- **DB authoritative**: the bot reads game truth from the DB/sim, never the reverse.

## 8. Safety & scope guardrails (load-bearing for a cannabis product)
- **Scope lock**: cannabis *cultivation* + GrowVerse gameplay only. Out-of-scope (medical dosing,
  legal advice, anything illegal) → refuse + redirect. Educational/simulation framing throughout.
- **Age-gate & compliance**: inherits the game's age-gating (Roadmap "Launch readiness"); no real-world
  sourcing/sale facilitation.
- **No covert power**: the bot advises and teaches; it does not silently auto-play the game or grant
  economy advantages beyond the existing *guarded, opt-in* auto-care. This keeps the "earned, never
  bought" line — and is exactly where C2's free-vs-paid boundary sits.

## 9. Recommendation
Build the bot as a **thin, tool-using orchestration layer** over three grounding sources (live state,
structured strain data, RAG-over-corpus) reusing the shipped advisor stack, with hard
cite-or-don't-answer grounding, hybrid retrieval, mock-backed CI-safety, and a scope/safety lock.
Corpus-RAG v1 now (design only, freeze-gated); knowledge-graph v2 later. Monetization boundary → C2.

## Sources
- [How RAG Reduces AI Hallucinations (2026) — Kernshell](https://www.kernshell.com/how-rag-reduces-ai-hallucinations-and-improves-accuracy/)
- [RAG Grounding: 11 Tests That Expose Fake Citations — Nexumo](https://medium.com/@Nexumo_/rag-grounding-11-tests-that-expose-fake-citations-30d84140831a)
- [RAG hallucination & how to avoid it — K2view](https://www.k2view.com/blog/rag-hallucination/) · [AI Hallucination Prevention — You.com](https://you.com/resources/ai-hallucination-prevention-guide)
- [Grounding & Evaluation for LLMs (survey, arXiv)](https://arxiv.org/pdf/2407.12858) · [Auto-GDA grounding verification (arXiv)](https://arxiv.org/pdf/2410.03461)
- Repo: `growpod/knowledge/*.md` · `docs/encyclopedia/SCHEMA.md` + `strains/*` · `src/growpodempire/ai/provider.py` · `services/advisor_service.py` · `ai/autocare.py` · `services/autocare_service.py` · `ai/factory.py`
