# GrowVerse University — Accessibility Conformance Checklist (WCAG 2.2 AA) (F5)

> **Records/Research only** (UNI-011 freeze-safe). The **ship-gate** accessibility checklist for every
> immersive-university surface, mapping the Phase-2 §10 standard + the established design-system rules
> to concrete, testable criteria. Accessibility is a **gate, not a polish pass** (Phase-2 §10). Status:
> **reference / acceptance checklist.**

## Global rules (apply to every surface)
- [ ] **Keyboard:** every interactive element reachable & operable by keyboard; logical tab order; no traps. *(2.1.1, 2.1.2, 2.4.3)*
- [ ] **Visible focus:** the shipped `:focus-visible` ring (2px `grow.400`, offset 2px) preserved everywhere. *(2.4.7, 2.4.11)*
- [ ] **Contrast:** text ≥ 4.5:1, large text/UI ≥ 3:1. *(1.4.3, 1.4.11)*
- [ ] **No color-only meaning:** pair every color signal (correct/healthy/severity) with icon or label. *(1.4.1)*
- [ ] **Reduced motion:** `prefers-reduced-motion` disables sway/orbit/shimmer/auto-advance. *(2.3.3)*
- [ ] **Targets:** ≥ 44px touch targets (mobile-first). *(2.5.8)*
- [ ] **SR semantics:** correct roles/names/states; live regions for async updates. *(4.1.2, 4.1.3)*
- [ ] **No audio/video-only or motion-only information.** *(1.2.x, 1.1.1)*
- [ ] **Dyslexia-friendly type option; resizable text to 200%.** *(1.4.4, 1.4.12)*

## Surface 1 — Lecture Player (B1/D2)
- [ ] **Captions on by default**; toggle persists. *(1.2.2)*
- [ ] **Full transcript** visible & synced — the narration script **is** the transcript (parity). *(1.2.1, 1.2.8)*
- [ ] Player controls keyboard-operable; state announced (play/pause/scrub/speed). *(2.1.1, 4.1.2)*
- [ ] No autoplay of audio without control; respects reduced-motion for avatar idle. *(1.4.2, 2.3.3)*
- [ ] Avatar video conveys nothing not also in caption/transcript/slide. *(1.1.1)*

## Surface 2 — 3D Anatomy Explorer (A1/A2/F1)
- [ ] **2D fallback** (the shipped Canvas macro-bud) for no-WebGL / low-end / reduced-motion — same labels & facts. *(graceful degradation)*
- [ ] `react-three-a11y`: every anatomy part **keyboard-focusable**; focusing updates **live alt-text** (e.g. "Calyx — teardrop, center seam, trichome frost cloudy"). *(2.1.1, 4.1.2, 1.1.1)*
- [ ] Part labels double as readable text (the transcript of the visual). *(1.1.1)*
- [ ] Auto-orbit & trichome shimmer **off** under reduced-motion; manual orbit retained. *(2.3.3)*
- [ ] Parameter sliders: labeled, keyboard-steppable, value announced; also shown numerically. *(1.3.1, 4.1.2)*
- [ ] No information conveyed by 3D rotation alone. *(1.1.1)*

## Surface 3 — Interactive Labs (A2 / Master Report §8)
- [ ] Every chart/gauge readout also given as a **data table** or announced value. *(1.1.1, 1.4.1)*
- [ ] Drag-drop interactions have a **keyboard equivalent**. *(2.1.1, 2.5.7)*
- [ ] Micrographs/symptom images **alt-texted**; diagnosis never color-only. *(1.1.1, 1.4.1)*
- [ ] Lab hints available as text (not audio-only). *(1.2.1)*
- [ ] Success/failure states announced via live region. *(4.1.3)*

## Surface 4 — Exams & Knowledge Checks (F3 / Master Report §7)
- [ ] Items fully keyboard-navigable; timed items (Countdown) have accessible time + warnings. *(2.1.1, 2.2.1)*
- [ ] Numeric/MCQ/drag-sort all have keyboard paths; answers/feedback SR-announced. *(2.1.1, 4.1.3)*
- [ ] Explained feedback is text; no reliance on color for correct/incorrect. *(1.4.1)*
- [ ] Generous/forgiving timing; no unexpected timeout data loss. *(2.2.1, 2.2.6)*

## Surface 5 — Master Grower Bot chat (C1/C2/F4)
- [ ] Chat log is an accessible live region; new messages announced. *(4.1.3)*
- [ ] Citation chips & care-action buttons keyboard-operable and labeled. *(2.1.1, 4.1.2)*
- [ ] Streaming responses don't break SR reading; final answer fully readable. *(4.1.3)*
- [ ] Upgrade nudges (C2) are honest, dismissible, not focus-trapping. *(2.4.3, no dark patterns)*

## Surface 6 — Campus / Transcript / Leagues (D2)
- [ ] Credential cards, progress rings, level meters have text equivalents (not ring-only). *(1.1.1)*
- [ ] Navigation landmarks/headings structured; skip-to-content. *(1.3.1, 2.4.1)*
- [ ] League/market visually distinct **and** labeled (non-economic vs. economic). *(1.4.1)*

## Verification method (how this gate is checked)
- [ ] Automated axe/lighthouse pass on each route (no critical violations).
- [ ] Manual keyboard-only walkthrough of each surface.
- [ ] Screen-reader pass (NVDA/VoiceOver) on lecture player, explorer, exam, bot.
- [ ] Reduced-motion + 200% zoom + high-contrast OS settings spot-checks.
- [ ] **No surface ships until its row set passes** (the gate).

## Cross-links
- Standard: `docs/memory/design/07-university-phase-2.md` §10 · design-system a11y rules: `docs/research/university/figma-design-system-rules.md` (D1 §1, §6)
- Surfaces: A1/A2 (3D) · B1 (lecture) · F1 (explorer) · F3 (assessments) · C1/C2/F4 (bot) · D2 (UI)
- Master plan/ledger: `docs/research/university/IMMERSIVE_UNIVERSITY_MASTER_PLAN.md`
