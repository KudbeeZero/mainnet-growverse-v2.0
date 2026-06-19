# GROWVERSE — UI Feature Buildouts (10 Lanes)

> **Status:** product/UX planning only. **No code in this document.**
> **Project:** GrowVerse / GrowPod Empire · Creator: Kudbee · Stage: alpha / early live testing · Chain direction: Algorand.
> **Transparency rule:** every feature is labeled with the project's own status vocabulary — `live | in-progress | placeholder | planned | not-wired` (source of truth: `growpod/web/src/lib/guide/guideContent.ts`). Nothing here is claimed live unless cited with a real file path.

## How to read the status labels
| Label | Meaning | UI badge tone |
|---|---|---|
| `live` | Shipping and wired; works for players | green |
| `in-progress` | Partial; being expanded | amber |
| `placeholder` | Minimal stub / proof-of-concept only | blue |
| `planned` | Design intent; not built | violet |
| `not-wired` | Architecture exists, no integration yet | neutral |

**Reusable building blocks that already exist (do not rebuild):**
- Notifications: `growpod/web/src/components/ui/Toast.tsx` (`success | error | info`, 4s auto-dismiss).
- Announcement strip: `growpod/web/src/components/layout/AnnouncementsBanner.tsx` + data in `growpod/web/src/lib/announcements.ts` (basis for the Grow Board).
- Onboarding overlay + in-game Grow Guide content: on branch `claude/integrate-onboarding` (`OnboardingOverlay.tsx`, `lib/guide/guideContent.ts`).
- FTUE backend step machine: `growpod/src/growpodempire/services/ftue_service.py`, coaching `ai/ftue_coach.py`.

---

## Lane 1 — Deep Guided Onboarding `in-progress`
**Player problem:** New players don't know what to tap first; a blank dashboard with no backend login can dead-end them.
**UI placement:** Full-screen spotlight overlay layered above the dashboard/nav; a "Restart tutorial" entry in the More menu and the Grow Guide.
**Mobile-first behavior:** Spotlight ring highlights the exact target, never covers it; instruction bubble auto-places to stay on-screen and one-thumb reachable; advances on the real action with a "Next" fallback.
**Desktop enhancement:** Wider bubble with keyboard `→`/`Esc` (next/skip); side-docked instead of bottom-docked.
**MVP:** 14-step welcome→claim tokens→plant→care→explore→Guide→finish, completion persisted per player.
**Future:** Branchy steps reacting to what the player already did; AI Master Grower voice (reuse `ftue_coach.py`).
**Empty/loading/error:** If a spotlight target isn't found within ~6s, fall back to a centered card + "Next" (never trap the player). If the backend login 404s, surface the offline demo path instead of a raw error.
**Transparency notes:** Label any step that points at a gated feature ("This part is in testing"). Do not auto-start on suppressed routes (`/onboarding`, `/ftue`).
**Testing checklist:** auto-starts once per player; skip + restart work; spotlight never covers target; survives missing targets; mobile bubble never off-screen; does not appear for returning players.
**Risk level:** Medium (global render path — see the green-screen incident; re-land behind a clean deploy + verified CI).
**Suggested branch:** `claude/ui-onboarding-deep`
**Recommended player copy:** "Welcome to GrowVerse. Let's plant your first seed and get your first grow moving."
**Screen layout:** dimmed strips around a glowing target + a compact card (step counter, one-line instruction, Skip / Next).
**Mobile interaction pattern:** tap-through on the real control; "↑ do this to continue" hint when no Next is allowed.
**Accessibility:** `role="dialog"`, `aria-live="polite"`, focus the bubble, respect reduced-motion (no pulse).
**What NOT to build yet:** gamified onboarding rewards tied to real economy; multi-session "campaign" tutorials.
**Stay honest in alpha:** never spotlight a placeholder as if it's live; say "in testing" inline.

---

## Lane 2 — Grow Board / Announcement Board `planned` (basis `live`)
**Player problem:** Players can't tell what's live vs being built vs coming next, which breeds rug-suspicion.
**UI placement:** A dedicated `/board` page + a compact rotating strip (reuse `AnnouncementsBanner`).
**Mobile-first:** Vertical stacked status cards with filter chips (Live Now / Being Worked On / Placeholder / Coming Next).
**Desktop enhancement:** Four-column kanban-style board.
**MVP:** Static curated list sourced from one data file, each item carrying a `live|in-progress|placeholder|planned` label.
**Future:** Auto-populate "Live Now" from the public `GET /api/game/flags` endpoint so the board can't drift from reality.
**Empty/loading/error:** empty = "No updates yet"; error = keep last cached list + "couldn't refresh."
**Transparency notes:** This board *is* the transparency promise — it must never list something as Live that the flags say is off.
**Testing checklist:** each item has a valid status; flags→board mapping correct; banner rotation pauses on focus/hover.
**Risk level:** Low.
**Suggested branch:** `claude/ui-grow-board`
**Recommended player copy:** section headers "🟢 Live Now · 🛠 Being Worked On · 🔵 Placeholder (not live) · 🟣 Coming Next."
**Screen layout:** four labeled groups; each card = title, one-line status, date.
**Mobile interaction:** swipe filter chips; tap card → detail.
**Accessibility:** status conveyed by text + icon, not color alone.
**What NOT to build yet:** voting/roadmap promises with dates you can't guarantee — use "Coming Next," never "Coming on <date>."
**Stay honest in alpha:** drive "Live Now" from `/api/game/flags`, not hand-maintained hype.

---

## Lane 3 — Grow Guide / Growpedia `in-progress`
**Player problem:** No in-game explanation of how to play, what's real, or the roadmap.
**UI placement:** `/guide` route, linked from nav + onboarding finish.
**Mobile-first:** Accordion sections; sticky search; each topic shows a status badge.
**Desktop enhancement:** Two-pane (topic list + content), deep-linkable anchors.
**MVP:** Data-driven topics (Getting Started, Grow Strategy, Lab/Genetics, Market, Cup, Transparency/Status, About) using the existing `GuideStatus` labels.
**Future:** Contextual "Open Guide here" deep links from each game screen; AI Q&A grounded in the guide content.
**Empty/loading/error:** never blank — ship with bundled content (no network dependency).
**Transparency notes:** The "Transparency / Status" section mirrors the Grow Board; keep them consistent.
**Testing checklist:** every topic renders; status badges match real flags; search finds expected topics.
**Risk level:** Low.
**Suggested branch:** `claude/ui-grow-guide`
**Recommended player copy:** "Everything in GrowVerse — what's live, what's in testing, and what's coming."
**Screen layout:** searchable topic index → article with a status pill at the top.
**Mobile interaction:** collapse/expand; back-to-top.
**Accessibility:** semantic headings, skip-to-section.
**What NOT to build yet:** promises of token price/returns; that belongs nowhere.
**Stay honest in alpha:** reuse `guideContent.ts` labels verbatim so the Guide can't over-claim.

---

## Lane 4 — Notifications + Grow Log `in-progress` (toast `live`)
**Player problem:** Clicks feel like no-ops; players don't get confirmation or a history of what happened to a plant.
**UI placement:** Toasts (global, reuse `Toast.tsx`) + a per-plant "Grow Log" feed on the plant detail.
**Mobile-first:** Toasts above the action tray; Grow Log as a scrollable timeline in the plant bottom-sheet.
**Desktop enhancement:** A small notification center (bell) aggregating recent events.
**MVP:** Toast on every meaningful action (water/feed/treat/apply/sell-attempt) + a reverse-chron plant event timeline.
**Future:** Filterable log (care vs stage vs milestone), unread badges, links from a notification to the relevant plant.
**Empty/loading/error:** empty log = "No activity yet — water or feed to begin"; error toast for failed actions (never silent).
**Transparency notes:** If an action is a QA placeholder, the toast says so ("Recorded (testing) — selling isn't live yet").
**Testing checklist:** every action emits exactly one toast; log entries persist + order correct; error states show.
**Risk level:** Low.
**Suggested branch:** `claude/ui-notifications-log`
**Recommended player copy:** "💧 Watered — moisture up." / "🌱 Stage change: Seedling → Vegetative."
**Screen layout:** timeline rows (icon, text, relative time).
**Mobile interaction:** pull-to-refresh; tap entry → context.
**Accessibility:** toasts `aria-live="assertive"` for errors, `polite` for info.
**What NOT to build yet:** push notifications / email — needs consent + infra.
**Stay honest in alpha:** never fake success; a no-op must say "nothing happened" or why.

---

## Lane 5 — Plant Suggestions / Inside the Grow `in-progress`
**Player problem:** Players don't understand *why* a plant is doing well or poorly.
**UI placement:** "Inside the grow" card on plant detail (`data-onboarding="plant-suggestions"`).
**Mobile-first:** Stacked explanation cards (photosynthesis, root growth, nutrient uptake, stress, stage, harvest-readiness).
**Desktop enhancement:** Side panel with a small live readout (VPD, PPFD, moisture bands).
**MVP:** Deterministic, rules-based explanations derived from the real engine state (health target, water/nutrient bands, conditions from `simulation/conditions.py`).
**Future:** AI Master Grower narrative (reuse advisor endpoint `/advisor`), trend arrows over time.
**Empty/loading/error:** loading skeleton; if advisor is gated/off, fall back to the deterministic rules version (never blank).
**Transparency notes:** Mark AI-generated text as "AI explanation" vs deterministic readouts; never invent numbers the engine didn't produce.
**Testing checklist:** explanations match actual plant levels; harvest-ready only when engine says so; fallback works when advisor off.
**Risk level:** Medium (must read true engine state, not guess).
**Suggested branch:** `claude/ui-plant-suggestions`
**Recommended player copy:** "Roots are establishing — moisture's in the sweet spot. Keep it steady and she'll move to Vegetative soon."
**Screen layout:** cards with an icon, plain-English line, and the underlying metric.
**Mobile interaction:** horizontal swipe between explanation cards.
**Accessibility:** don't rely on color for stress; include text.
**What NOT to build yet:** predictive yield/price promises.
**Stay honest in alpha:** label display-only nutrient readouts as "display only" (the engine already separates these — see `balance.yaml` stage_targets comment).

---

## Lane 6 — If My Plant Could Talk / Plant Journal `planned`
**Player problem:** Numbers are dry; players bond with characters, not stats.
**UI placement:** "Journal" tab on plant detail.
**Mobile-first:** Chat-bubble-style dated entries written from the plant's POV.
**Desktop enhancement:** Two-column journal + mood graph.
**MVP:** Template-driven entries keyed off real state changes (thirsty, fed, stressed, new stage) — deterministic, no LLM required.
**Future:** AI-authored personality entries with consistent voice per plant (seeded by genetics).
**Empty/loading/error:** new plant = a friendly first entry ("Just a seed for now — water me to wake up!").
**Transparency notes:** Mark AI entries as flavor; they must not state mechanics that aren't real.
**Testing checklist:** entries map to real events; tone consistent; no claims of fake features.
**Risk level:** Low–Medium.
**Suggested branch:** `claude/ui-plant-journal`
**Recommended player copy:** "Day 3 — feeling parched today. A drink would be lovely. 🌵"
**Screen layout:** dated bubbles, newest at bottom.
**Mobile interaction:** scroll; tap an entry to see the underlying event.
**Accessibility:** entries are real text (screen-reader friendly).
**What NOT to build yet:** plant "relationships"/social mechanics.
**Stay honest in alpha:** flavor text never implies a boost/feature that isn't built.

---

## Lane 7 — Plant Persona / Mascot UI `planned`
**Player problem:** Plants look generic; mood isn't glanceable.
**UI placement:** Portrait/avatar on the plant card and detail header.
**Mobile-first:** Small animated face/leaf with a mood state (happy, thirsty, hungry, stressed, thriving, harvest-ready).
**Desktop enhancement:** Larger portrait with subtle idle animation.
**MVP:** Static mood sprites chosen from the real condition + health bands.
**Future:** Genetics-seeded appearance; reuse the "living particle leaf" identity from `announcements.ts`.
**Empty/loading/error:** unknown state → neutral portrait, never a broken image.
**Transparency notes:** Mood reflects real engine state only.
**Testing checklist:** mood matches conditions; harvest-ready mood only when truly ready; no broken assets.
**Risk level:** Low.
**Suggested branch:** `claude/ui-plant-persona`
**Recommended player copy:** mood captions — "Thriving 🌟", "Thirsty 💧", "Stressed 😣".
**Screen layout:** avatar + mood caption + tiny health bar.
**Mobile interaction:** tap avatar → "Inside the grow" (Lane 5).
**Accessibility:** mood as text caption, not color/emoji alone.
**What NOT to build yet:** purchasable cosmetic skins (economy review needed).
**Stay honest in alpha:** mascot is cosmetic; it doesn't change outcomes.

---

## Lane 8 — Market Sell Feedback `in-progress` (marketplace `live` in code, gated for MVP)
**Player problem:** Selling silently does nothing when gated, which feels broken/untrustworthy.
**UI placement:** Sell button on harvest/plant detail + market screens.
**Mobile-first:** Clear button states: live → confirm + result; gated → "Selling isn't live yet" message; QA → "Recorded (testing)."
**Desktop enhancement:** Inline price/fee breakdown (3% listing fee, 5% sale tax — real sinks from `balance.yaml:77–78`).
**MVP:** Honest states for the three cases; satisfying confirmation + Grow Log entry when live.
**Future:** Animated sale confirmation, price history, listing management.
**Empty/loading/error:** no listings = "Nothing listed yet"; failure = explicit error toast.
**Transparency notes:** Marketplace is built but **gated OFF in the MVP launch profile** — the UI must reflect the live flag (`/api/game/flags`), not assume.
**Testing checklist:** gated state shows honest copy; fee math matches balance.yaml; no silent no-op.
**Risk level:** Medium (touches real economy display).
**Suggested branch:** `claude/ui-market-sell-feedback`
**Recommended player copy:** "Selling isn't live yet — it's coming. Your harvest is safe." / "Sold! −5% tax applied. +X GROW."
**Screen layout:** price, fee/tax lines, net, confirm.
**Mobile interaction:** confirm sheet before any value-moving action.
**Accessibility:** confirmations are dialogs with focus trap.
**What NOT to build yet:** real-money cashout language; this is in-game GROW only.
**Stay honest in alpha:** never show a fake "sold"; reflect the flag truthfully.

---

## Lane 9 — Early Tester Status / Rewards Eligibility `planned`
**Player problem:** Early testers want to know their participation is recognized — without being promised payouts.
**UI placement:** A "Tester Status" card on the Profile page.
**Mobile-first:** Checklist of transparent milestones (joined early testing, planted first seed, submitted feedback, wallet connected status).
**Desktop enhancement:** Timeline + copyable tester ID.
**MVP:** Read-only status checklist from real signals (account age, first plant, wallet-link flag).
**Future:** "Recognition notes" describing *possible, not guaranteed* future acknowledgement.
**Empty/loading/error:** unmet milestones shown as "Not yet," never hidden.
**Transparency notes:** Use **only** "may," "planned," "recognition" — **never** "reward," "guaranteed," "airdrop," or value claims.
**Testing checklist:** each milestone reflects real data; no guaranteed-reward language anywhere.
**Risk level:** Medium (legal/expectation risk — wording matters).
**Suggested branch:** `claude/ui-tester-status`
**Recommended player copy:** "Thanks for testing early. Future recognition is planned but not guaranteed — we'll publish details before anything goes live."
**Screen layout:** milestone checklist + honest disclaimer footer.
**Mobile interaction:** tap milestone → what it means.
**Accessibility:** checkmarks have text labels.
**What NOT to build yet:** any points-with-monetary-value system, allowlists implying value.
**Stay honest in alpha:** no promise of tokens/NFTs/money. Period.

---

## Lane 10 — Mobile Grow Dashboard Redesign `in-progress`
**Player problem:** The dashboard is cramped on phones; key actions are hard to reach one-handed.
**UI placement:** The main `/dashboard`.
**Mobile-first:** Swipeable plant cards, bottom-sheet plant detail, one-hand action tray, a "Next best action" button, safe-area aware.
**Desktop enhancement:** Multi-column grid; hover quick-actions.
**MVP:** Swipe cards + bottom sheet + action tray; "Next best action" derived from the worst current stat.
**Future:** Drag-to-reorder, multi-plant batch care.
**Empty/loading/error:** no plants = friendly empty state with a "Plant your first seed" CTA; loading skeleton cards.
**Transparency notes:** "Next best action" reflects real engine recommendations, not nudges to spend.
**Testing checklist:** swipe works; bottom sheet dismiss; tray within thumb zone; safe-area on notched devices; next-best-action correct.
**Risk level:** Medium (core screen).
**Suggested branch:** `claude/ui-mobile-dashboard`
**Recommended player copy:** "Next best action: 💧 Water Blue Dream — moisture is low."
**Screen layout:** card carousel → tap → bottom sheet (stats, care tray, Inside-the-grow).
**Mobile interaction:** horizontal swipe between plants; sheet drag-to-dismiss.
**Accessibility:** swipe has button alternatives; 44px targets; respects reduced-motion.
**What NOT to build yet:** monetized "auto-care"/auto-climate (still a `placeholder`).
**Stay honest in alpha:** next-best-action optimizes the plant, never upsells.

---

## Cross-cutting: how every lane stays honest in alpha
1. Drive "live" claims from `GET /api/game/flags`, not hard-coded optimism.
2. Use the five status labels everywhere; show the badge in-UI.
3. No silent no-ops (Lane 4/8).
4. No money/NFT/return promises anywhere (Lane 9 especially).
5. Re-land the onboarding bundle only behind a clean deploy + green CI (see the green-screen incident note in the roadmap doc).
