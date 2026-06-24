# GROWVERSE — AI Assistance Feature Buildouts (10 Lanes)

> **Status:** product/UX planning only. **No code in this document.**
> **Project:** GrowVerse / GrowPod Empire · Creator: Kudbee · Stage: alpha / early live testing · Chain direction: Algorand.
> **Theme:** the **AI bot can be asked for assistance**, it **evaluates the real grow state**, and it **gives correct, grounded assistance**. Assistance is an **optional boost** (you "pay a price" for it later) but is **FREE + QA-labeled during alpha** so we can test it now.
> **Transparency rule:** every feature is labeled with the project's own status vocabulary — `live | in-progress | placeholder | planned | not-wired` (source of truth: `growpod/web/src/lib/guide/guideContent.ts`). Nothing here is claimed live unless cited with a real file path.

## How to read the status labels
| Label | Meaning | UI badge tone |
|---|---|---|
| `live` | Shipping and wired; works for players | green |
| `in-progress` | Partial; being expanded | amber |
| `placeholder` | Minimal stub / proof-of-concept only | blue |
| `planned` | Design intent; not built | violet |
| `not-wired` | Architecture exists, no integration yet | neutral |

## What already exists vs what is new (honest baseline)
| Mechanic | Status | Evidence |
|---|---|---|
| **AI Master Grower advisor** — read-only, runs sim catch-up then asks the configured provider | `live` (backend) | `GET /players/<id>/plants/<id>/advisor` → `api/game_api.py:621`, `services/advisor_service.py` |
| Swappable AI providers behind an ABC (deterministic **Mock** for CI, **Claude** in prod) | `live` | `ai/provider.py`, `ai/factory.py`, `ai/mock.py`, `ai/claude.py` |
| Agentic **auto-care** routine | `placeholder`/`in-progress` | `ai/autocare.py` |
| Scripted FTUE coaching (per-step, deterministic) | `live` | `ai/ftue_coach.py`, `services/ftue_service.py` |
| Deterministic rules-based plant explanations (no LLM) | basis for fallback | `simulation/conditions.py`, plant `/state` |
| **Assistance pricing / credits / boost meter** | `planned` (does not exist) | no per-call assistance sink in `economy/ledger.py` |

**Engine reality that constrains design:** the advisor is **read-only** and **grounded in compute-on-read engine state** — it must never invent numbers the engine didn't produce, and CI runs the **Mock** provider (never a live key). Any "give correct assistance that applies a fix" path reuses the existing **`live` consumables / care actions**; the AI chooses *which* real action to recommend, it does not invent new mechanics. The "evaluate" step is a **grounding + confidence gate**, echoing the Evaluator-rubric idea (assert against real state, 2–3 passes) — not a vibe.

**Economy guardrail (must respect):** money is `Decimal` 6-dp on a **double-entry, append-only, inflation-audited ledger** (`economy/ledger.py`). Charging for AI assistance is a **sink** and must post to the ledger like any spend. **In alpha every assistance action is FREE and QA-labeled** (mirrors `balance.yaml` `# FREE for testing — restore … before launch`). No real money, no GROW minted by an assist beyond a documented effect.

---

## Lane A1 — Ask the Master Grower (on-demand help) `planned` (advisor `live`)
**Player problem:** Players hit a wall ("why is she drooping?") with no one to ask; the advisor exists but isn't a first-class "ask me anything" button.
**UI placement:** A persistent "Ask the Master Grower" action on plant detail + a floating help button on the dashboard.
**Mobile-first:** Bottom-sheet chat; quick-ask chips ("What's wrong?", "What should I do next?", "Is she ready?") so no typing is required.
**Desktop enhancement:** Side panel chat with the plant's live readout pinned alongside.
**MVP:** One-tap question → calls `/advisor` → renders the grounded report; quick-ask chips map to canned prompts.
**Future:** Free-text questions; multi-plant / whole-grow questions; voice (reuse `ai/elevenlabs_narrator.py`).
**Empty/loading/error:** loading = "Master Grower is looking at your plant…"; if the provider is gated/off, fall back to the **deterministic rules** explanation (Lane A4), never blank; error toast on provider failure (`AdvisorError`).
**Transparency notes:** Mark replies "AI explanation"; the advisor is read-only and cannot change the plant from this lane.
**Boost economy:** one assist = one credit (Lane A5). **Test-mode:** "Ask — Free (testing)." **Future-paid:** small tier or in-game GROW. **Affects harvest/rewards?** No (advice only). **Cup/ranked?** Allowed (read-only advice).
**Testing checklist:** chips call the real endpoint; gated → deterministic fallback; one assist decrements one credit in alpha-free mode (logged, $0).
**Risk level:** Low–Medium (must read true engine state).
**Suggested branch:** `claude/ai-ask-master-grower`
**Recommended player copy:** "Stuck? Ask the Master Grower — she reads your real grow and tells you straight."
**Accessibility:** chat is real text; `aria-live="polite"`; focus trapped in the sheet.
**What NOT to build yet:** advice that promises yield/price outcomes.
**Stay honest in alpha:** label every reply AI vs deterministic; never imply the advice moved value.

---

## Lane A2 — One-Tap Evaluate (Diagnose My Plant) `planned`
**Player problem:** Players don't know *what's actually wrong* — they want a diagnosis, not a chat.
**UI placement:** "Evaluate" button on the plant card and the "Inside the grow" panel (Lane 5 of the UI builds).
**Mobile-first:** Tap → a ranked findings list (worst-first): each finding = symptom, the real metric behind it, and a one-line cause.
**Desktop enhancement:** Findings table with the engine values inline (VPD/PPFD/moisture/pest/disease bands).
**MVP:** Calls `/advisor` in a "diagnose" mode; renders a **rubric-style findings list** scored against real `simulation/conditions.py` bands.
**Future:** Trend-aware findings (improving/worsening); compare against strain-ideal bands.
**Empty/loading/error:** healthy plant = "No issues found — she's in the sweet spot."; provider off = deterministic band check still produces findings.
**Transparency notes:** Each finding cites the real metric; no finding without an engine value behind it.
**Boost economy:** one evaluate = one credit. **Test-mode:** "Evaluate — Free." **Future-paid:** small tier. **Affects harvest/rewards?** No. **Cup/ranked?** Allowed.
**Testing checklist:** findings match actual levels; healthy plant returns none; severity ordering is worst-first.
**Risk level:** Medium (truthful diagnosis).
**Suggested branch:** `claude/ai-evaluate-plant`
**Recommended player copy:** "💧 Moisture low (sweet spot 60–75%, you're at 41%) — she's thirsty."
**Accessibility:** findings are text with the metric, not color-coded alone.
**What NOT to build yet:** auto-applying fixes here (that's Lane A3, behind confirmation).
**Stay honest in alpha:** never fabricate a problem to drive a "fix" purchase.

---

## Lane A3 — Guided Fix-It (correct assistance, applied with consent) `planned` (consumables `live`)
**Player problem:** A diagnosis without a fix is half-help; players want the *correct* next action, ready to do.
**UI placement:** Under each Lane A2 finding: a "Fix this" button mapping to a **real, existing** care action / consumable.
**Mobile-first:** One-tap apply with a confirm sheet (what it does, the real cost, the effect).
**Desktop enhancement:** "Apply all recommended" with an itemized preview.
**MVP:** The AI maps each finding to a **`live` action** (water/feed/Cal-Mag/Neem/Ladybugs/Bloom Booster/Rejuvenation Tonic — `balance.yaml:340–355`) and offers it; the player confirms; the existing `/apply` path runs.
**Future:** Bundled "care plan" sequencing; schedule reminders for the next correct action.
**Empty/loading/error:** if no live action fixes a finding, say so honestly ("No in-game fix for this yet") — never invent one.
**Transparency notes:** The AI **chooses among real actions only**; it cannot create mechanics. The applied change is a normal ledgered care action.
**Boost economy:** the *recommendation* is an assist credit; the *applied consumable* is its normal in-game GROW cost (FREE in alpha per `balance.yaml`). **Test-mode:** "Fix — Free (testing)." **Future-paid:** the assist tier; consumables stay in-game GROW. **Affects harvest/rewards?** Indirect (healthier plant). **Cup/ranked?** Allowed only if it mirrors free actions (owner call — see fairness doc).
**Testing checklist:** every "Fix this" maps to a real action that exists; confirm sheet shows real cost/effect; no silent apply.
**Risk level:** Medium–High (touches plant state + ledger).
**Suggested branch:** `claude/ai-guided-fixit`
**Recommended player copy:** "Recommended fix: 💧 Water now → moisture back to the sweet spot. Apply?"
**Accessibility:** confirm dialog with focus trap; effect described in text.
**What NOT to build yet:** auto-apply without a confirm; new "AI-only" consumables.
**Stay honest in alpha:** the confirm sheet shows the *real* cost even when it's $0/free-testing.

---

## Lane A4 — Confidence & Grounding (the Evaluate gate) `planned`
**Player problem:** AI that bluffs erodes trust; players need to know when the bot is sure vs guessing.
**UI placement:** A confidence pill + "what this is based on" expander on every assist reply (A1/A2/A3).
**Mobile-first:** Pill (High / Medium / Low) + a tap-to-expand list of the engine values the answer used.
**Desktop enhancement:** Inline "grounded on" chips next to each claim.
**MVP:** The advisor returns a confidence + the metrics it grounded on; **Low confidence → it says "I'm not sure" and routes to the deterministic rules answer** rather than guessing.
**Future:** Per-claim citations; "show your work" trace; uncertainty bands on numeric advice.
**Empty/loading/error:** if grounding data is missing, the bot declines ("I can't see enough to be sure") — never fabricates.
**Transparency notes:** This is the project's **no-dark-patterns / honesty-and-trust** charter made visible (`docs/memory/design/04-honesty-and-trust.md`); confidence must reflect real grounding, not be cosmetic.
**Boost economy:** no extra charge — grounding ships with every assist. **Affects harvest/rewards?** No. **Cup/ranked?** Allowed.
**Testing checklist:** low-grounding inputs yield Low confidence + deterministic fallback; expander lists only real metrics; no claim without a cited value.
**Risk level:** Medium (defines trustworthiness of the whole package).
**Suggested branch:** `claude/ai-confidence-grounding`
**Recommended player copy:** "Confidence: High — based on moisture 41%, VPD 1.6 kPa, stage Vegetative."
**Accessibility:** confidence as text label, not color alone.
**What NOT to build yet:** fake precision (decimals the engine didn't produce).
**Stay honest in alpha:** a confident-sounding wrong answer is the failure mode this lane exists to prevent.

---

## Lane A5 — Assistance Credits / Boost Meter (the "price") `planned`
**Player problem:** "You pay a price for it" needs an honest, visible meter — not a surprise paywall.
**UI placement:** A small "Assist" meter in the header; a detail page explaining how credits work.
**Mobile-first:** Compact meter (e.g. "Assists: ∞ — Free in alpha"); tap → explainer.
**Desktop enhancement:** Sidebar widget with recent-assist history (links to Lane A9).
**MVP:** A **read-only meter** that shows assists are **FREE + unlimited in alpha**, QA-labeled; the spend path is wired to the ledger but charges **0** (mirrors `balance.yaml` free-testing convention).
**Future:** Real credit balance (earned in-game GROW and/or future-paid tiers); top-up flow gated behind RISK #7 (real settlement) + an explicit owner green-light.
**Empty/loading/error:** never shows a balance you can't honor; if credits are off, "Free in alpha."
**Transparency notes:** **Stop-and-ask surface** — any move from "free" to "costs money/GROW" is a player-facing economy change (owner decision per CLAUDE.md). This lane only *describes and meters*, it does not activate a charge.
**Boost economy:** this **is** the boost-economy surface for the package. **Test-mode:** "Free in alpha — no payment required." **Future-paid:** credit tiers (USD + approx ALGO per the liquidity model) **only after owner approval.** **Affects harvest/rewards?** No (buys help, not yield). **Cup/ranked?** N/A (meter).
**Testing checklist:** alpha = unlimited/free; every assist posts a $0 ledger entry (auditable); no real charge path reachable without the flag + owner gate.
**Risk level:** High (economy/expectations — words and gating matter).
**Suggested branch:** `claude/ai-assist-credits-meter`
**Recommended player copy:** "Assists are **free while we test**. Later they may cost a small amount — we'll tell you clearly before that ever changes."
**Accessibility:** meter state in text; explainer is plain language.
**What NOT to build yet:** any real-money or GROW charge for assists; top-up UI implying value.
**Stay honest in alpha:** never imply scarcity to pressure a purchase; free means free, and the meter says so.

---

## Lane A6 — Ask-in-Context (assist anchored to where you are) `planned`
**Player problem:** Generic help is weak; players want help about *this* plant, *this* screen, *this* problem.
**UI placement:** A contextual "Ask about this" affordance on plant detail, the climate rail, the market screen, the lab.
**Mobile-first:** Long-press / "?" on a control opens an assist pre-scoped to that context.
**Desktop enhancement:** Hover "?" with a quick-ask popover.
**MVP:** The assist call carries the current screen + plant id so the advisor answers in-context (reuses `/advisor` with a context hint).
**Future:** Deep-link from an assist answer to the exact control to act on.
**Empty/loading/error:** unknown context = falls back to the general Ask (Lane A1).
**Transparency notes:** Context is gameplay state only; no personal data leaves the session.
**Boost economy:** one in-context assist = one credit (same meter as A5). **Test-mode:** Free. **Affects harvest/rewards?** No. **Cup/ranked?** Allowed.
**Testing checklist:** context is passed correctly; answers reference the right plant/screen; falls back gracefully.
**Risk level:** Low–Medium.
**Suggested branch:** `claude/ai-ask-in-context`
**Recommended player copy:** "Ask about this grow" / "Not sure what this does? Ask."
**Accessibility:** the "?" affordance has a label; popover is keyboard reachable.
**What NOT to build yet:** scraping anything beyond game state into the prompt.
**Stay honest in alpha:** in-context answers obey the same grounding/confidence gate (A4).

---

## Lane A7 — Second Opinion / Re-Evaluate (2–3 passes) `planned`
**Player problem:** Players want to double-check important calls (harvest now vs wait) before acting.
**UI placement:** A "Re-evaluate" / "Second opinion" action on any assist reply.
**Mobile-first:** Tap → a fresh evaluation pass; shows whether the passes **agree**.
**Desktop enhancement:** Side-by-side pass comparison with a consensus line.
**MVP:** Runs the evaluate path **2–3 times** and surfaces agreement/disagreement (mirrors the Evaluator-rubric multi-pass idea); on disagreement, defaults to the **safer** recommendation.
**Future:** Distinct "lenses" per pass (health, timing, economics) instead of identical re-runs.
**Empty/loading/error:** if passes diverge sharply, say "the read is uncertain — here's the cautious call," never pick silently.
**Transparency notes:** Shows that AI can be uncertain; disagreement is surfaced, not hidden.
**Boost economy:** a second opinion costs one **additional** credit (it does more work — the honest "pay a price" moment). **Test-mode:** Free. **Affects harvest/rewards?** No (still advice). **Cup/ranked?** Allowed.
**Testing checklist:** passes run independently; consensus/▵disagreement shown; safe-default on conflict.
**Risk level:** Medium.
**Suggested branch:** `claude/ai-second-opinion`
**Recommended player copy:** "Want a second opinion? I'll check again — costs one assist."
**Accessibility:** agreement state in text; comparison is a real table.
**What NOT to build yet:** infinite re-rolls to farm a desired answer (cap passes).
**Stay honest in alpha:** if the bot disagrees with itself, the player sees that.

---

## Lane A8 — Proactive Watch → Offer Assistance `planned` (alerts basis `in-progress`)
**Player problem:** Players miss problems between sessions; the bot should notice and *offer* help, not nag or auto-spend.
**UI placement:** A non-intrusive alert (reuse `AnnouncementsBanner` / `Toast.tsx`) + a "Master Grower noticed…" entry on the dashboard.
**Mobile-first:** A single calm banner: "Your Blue Dream looks stressed — want me to take a look?" → opens the evaluate sheet.
**Desktop enhancement:** A notification-center item.
**MVP:** A deterministic watcher flags out-of-band plants and **offers** an evaluate (the offer is free; the evaluate uses the meter); the player always initiates the actual assist.
**Future:** Smart cadence (don't repeat the same alert), welcome-back summary on return (ties to BACKLOG WO-2 session-delta endpoint).
**Empty/loading/error:** nothing wrong = no alert (silence is correct); never alert without a real flag.
**Transparency notes:** The bot **offers**, never auto-charges or auto-acts; the trigger is real engine state.
**Boost economy:** the *offer* and *noticing* are free; accepting runs a metered evaluate. **Affects harvest/rewards?** No. **Cup/ranked?** Allowed.
**Testing checklist:** alerts only on real out-of-band state; no duplicate spam; accepting opens evaluate; declining costs nothing.
**Risk level:** Medium (must not feel like manipulation).
**Suggested branch:** `claude/ai-proactive-watch`
**Recommended player copy:** "👀 I noticed your grow looks stressed. Want me to evaluate it? (free while we test)"
**Accessibility:** alert is dismissible text; respects reduced-motion.
**What NOT to build yet:** alerts engineered to drive spend; auto-purchasing anything.
**Stay honest in alpha:** an alert that can't be backed by a real metric must not fire.

---

## Lane A9 — Was-It-Right? Assistance History & Feedback `planned`
**Player problem:** Players (and we) need to know whether the AI's "correct assistance" was actually correct.
**UI placement:** An "Assist History" list on the profile / plant; a 👍/👎 on every assist reply.
**Mobile-first:** Reverse-chron list of past assists with the question, the answer, confidence, and a "Was this right?" rating.
**Desktop enhancement:** Filterable history (by plant, by outcome) + an aggregate "helpfulness" readout (honest, not inflated).
**MVP:** Log each assist (question, grounded values, recommendation, confidence) + capture 👍/👎; show the player their own history.
**Future:** Feed ratings into provider/rubric tuning (the closed Evaluator loop); surface "the bot was wrong here" honestly.
**Empty/loading/error:** no history = "No assists yet — ask the Master Grower anything."
**Transparency notes:** We show when the bot was rated wrong; we don't hide misses to look smarter.
**Boost economy:** free — reviewing history never costs a credit. **Affects harvest/rewards?** No. **Cup/ranked?** Allowed.
**Testing checklist:** every assist is logged with its grounding; ratings persist; history is per-player and private.
**Risk level:** Medium (trust depends on showing misses).
**Suggested branch:** `claude/ai-assist-history`
**Recommended player copy:** "Was this helpful?" / "Your past help — and how it turned out."
**Accessibility:** ratings are labeled buttons; list is semantic.
**What NOT to build yet:** public leaderboards of AI accuracy; sharing another player's data.
**Stay honest in alpha:** a low helpfulness score is shown truthfully, not massaged.

---

## Lane A10 — Safe Auto-Pilot Assist (bounded, opt-in) `planned` (autocare `placeholder`)
**Player problem:** Some players want the bot to *handle it* — but unbounded auto-care is pay-to-win and removes the game.
**UI placement:** An explicit opt-in toggle on plant detail ("Let the Master Grower keep her stable") with clear bounds shown.
**Mobile-first:** Off by default; turning it on shows exactly what it will/won't do and the caps.
**Desktop enhancement:** A rules panel (which actions, frequency caps, when it pauses for you).
**MVP:** Reuses `ai/autocare.py` to perform **only correct, capped, real care actions** (water/feed within band) with **strict caps + cooldowns**; logs every auto-action to the Grow Log; pauses and asks for anything risky or value-bearing.
**Future:** Per-strain auto-profiles; "explain why it acted" trace tied to Lane A4 grounding.
**Empty/loading/error:** if it can't act safely, it **pauses and notifies** rather than guessing.
**Transparency notes:** Bounded by design — it cannot sell, mint, breed, or spend real money; every action is logged and reversible-in-spirit (forward-only engine).
**Boost economy:** auto-pilot is the **premium tier** of the package (it spends assists over time). **Test-mode:** Free + capped in alpha. **Future-paid:** medium tier or in-game GROW. **Affects harvest/rewards?** Yes (it keeps plants healthier) → **Cup/ranked: NO** (excluded/tagged per the fairness doc — auto-care removes the care-skill moat).
**Testing checklist:** off by default; never exceeds caps/cooldowns; never sells/mints/breeds; every action logged; pauses on risk.
**Risk level:** High (fairness + economy + autonomy — the most gated lane).
**Suggested branch:** `claude/ai-auto-pilot-assist`
**Recommended player copy:** "Auto-pilot keeps her watered and fed within safe limits. It never sells, breeds, or spends real money — and it tells you everything it does."
**Accessibility:** toggle clearly labeled on/off; action log is readable text.
**What NOT to build yet:** auto-sell, auto-breed, auto-mint, or any real-money auto-spend; uncapped auto-care.
**Stay honest in alpha:** ranked/Cup exclusion is enforced and stated up front, not buried.

---

## Cross-cutting: how the AI-assistance package stays honest in alpha
1. **Free means free.** Every assist is FREE + QA-labeled in alpha; the spend path posts a **$0, auditable** ledger entry. Moving off free is a **stop-and-ask** owner decision (CLAUDE.md).
2. **Grounded or silent.** No assist claims a number the engine didn't produce; Low confidence → deterministic fallback or an honest "I'm not sure" (Lane A4).
3. **Read-only by default; consent to act.** A1/A2/A4/A6/A7/A9 never change the plant. A3/A8/A10 act **only** on real, existing actions and **only** with the player's consent / opt-in.
4. **CI runs the Mock provider** (`ai/mock.py`) — never a live key, per the providers-are-swappable invariant.
5. **No pay-to-win in ranked.** Assists that affect outcomes (A3 applied, A10 auto-pilot) are excluded/tagged in Cup/ranked per `GROWVERSE_FAIRNESS_GUARDRAILS.md`.
6. **Show the misses.** Helpfulness (A9) is reported truthfully; a wrong answer is surfaced, not hidden.

## Open design questions for the owner
1. **Pricing model:** assists priced in **in-game GROW**, future real money, or both? (Lane A5 keeps it free until you decide.)
2. **Auto-pilot (A10):** ship the **bounded, capped** version on existing actions, or keep it `placeholder` until fairness sign-off?
3. **Cup/ranked:** which assist lanes are **flatly banned** vs **tagged**?
4. **Caps:** per-day assist cap, second-opinion (A7) pass cap, and auto-pilot (A10) action/cooldown limits.
5. **Grounding bar:** what confidence threshold (A4) forces the deterministic fallback instead of an LLM answer?
