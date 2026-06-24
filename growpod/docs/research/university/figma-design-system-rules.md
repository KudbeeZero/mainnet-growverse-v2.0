# GrowVerse Design System Rules — extracted from `web/` (D1)

> **Records/Research only** (UNI-011 freeze-safe). The **design-system rules** for GrowVerse,
> reverse-engineered from the live `web/` codebase so Figma work and new university UI stay
> on-system. (The Figma `create_design_system_rules` command isn't exposed by this MCP server, so
> this doc is authored directly from `tailwind.config.ts`, `globals.css`, and `web/src/components/ui/`
> — the same artifact that command produces.) Part of Track D. Status: **reference.**
> **Source of truth = the code; if code changes, update this doc.**

## 1. Foundations
- **Theme:** dark-only (`color-scheme: dark`; body = `bg-ink-950 text-gray-100 antialiased`). Design
  every university surface dark-first.
- **Type:** `font-sans` → `var(--font-sans)` = **Inter** + system fallback (set by `next/font`);
  `font-mono` → `var(--font-mono)` (instrument readouts, codes, numbers). No build-time webfont fetch
  (offline/CSP-clean) — Figma should use **Inter** (note: "Semi Bold", not "SemiBold").
- **Focus ring (a11y, non-negotiable):** `:focus-visible` = `2px solid grow.400`, `offset 2px`,
  `radius 4px`. Every interactive element keeps this. Keyboard/SR users get a visible target; mouse
  taps stay clean.

## 2. Color tokens (Tailwind `theme.extend.colors`)
| Token ramp | Hex anchors | Meaning / usage |
|---|---|---|
| **grow** (primary) | 400 `#76c024` · 500 `#5aa015` · 700 `#356010` · 900 `#274014` (50→900) | brand green; primary CTAs, healthy/growth, focus ring, success |
| **ink** (neutral) | 950 `#070a0e` · 900 `#0d1117` · 800 `#161b22` · 700 `#21262d` · 600 `#30363d` · 500 `#484f58` | backgrounds & elevations (950 base → 800/700 cards → 600/500 borders) |
| **accent** (sky) | 300 `#7dd3fc` · 400 `#38bdf8` · 500 `#0ea5e9` · 600 `#0284c7` | data/analysis: instrument readouts, links, charts, **VPD/DLI/PPFD** |
| **violet** (genetics) | 300 `#c4b5fd` · 400 `#a78bfa` · 500 `#8b5cf6` | DNA hubs, breeding, lineage/GenBank |
- **Text:** body `gray-100`; mute toward `gray-400`/`ink-500` for secondary. Maintain **contrast ≥
  4.5:1** (Phase-2 §10).
- **Semantic mapping for the university:** grow = progress/correct/healthy · accent = readouts &
  the bot's data answers · violet = genetics coursework · ink = all chrome.

## 3. Elevation, glow & shadow
- `shadow-glow-grow` — green glow (primary emphasis, active/healthy).
- `shadow-glow-accent` — sky glow (data/instrument emphasis).
- `shadow-glow-soft` — subtle ring + drop (default card lift).
- Surfaces stack: `ink-950` page → `ink-900/800` panels → `ink-700` insets → `ink-600/500` hairlines.

## 4. Motion (Tailwind + globals)
- `animate-twinkle` (constellation stars), `animate-pulse-ring` (attention/active node),
  `animate-fade-up` (entry, 0.35s). Plant body: `gpe-anim-sway`/`droop`/`wilt-hard`/`shrivel`/`none`,
  **intensity scaled by `--stress` (0..1)** — health-driven, not random.
- **Reduced-motion:** all of the above must be gated by `prefers-reduced-motion` for university
  surfaces (the 3D explorer + lecture autoplay especially — A1 §6 / A2).

## 5. Component library (`web/src/components/ui/` — reuse, don't reinvent)
**Primitives:** `Button`, `Card`, `Badge`, `Pills`, `Field`, `Modal`, `Tabs`, `Toast`, `Spinner`,
`CollapsiblePanel`, `PageHeader`, `States` (empty/loading/error).
**Data-viz / game:** `Bar`, `Gauge`, `Metric`, `ProgressRing`, `Countdown`.
**Mobile / layout:** `StickyActionBar` (≥44px thumb-zone CTAs), bottom-tab nav (mobile-first, PR #36).
Plus the signature dependency-free `<Constellation>` Canvas engine (DNA/breeding/GenBank).

**Rule:** new university UI composes these first. A new component is justified only when no
primitive fits; it must adopt the tokens above and the focus-ring rule.

## 6. Rules for new (university) components
1. **Token-only** — colors/spacing/shadows from the Tailwind theme; no hardcoded hex.
2. **Dark-first**, contrast ≥ 4.5:1, `:focus-visible` ring preserved.
3. **Mobile-first** — ≥44px touch targets, safe-area aware, responsive (Roadmap mobile track).
4. **Reduced-motion respected**; **no color-only meaning** (pair with icon/label).
5. **Compose the existing `ui/` primitives**; match their prop/variant conventions.
6. **Accessibility = ship gate** (Phase-2 §10): keyboard, SR semantics, transcript parity for media.

## 7. Semantic palette cheat-sheet for university surfaces
- Course progress / correct answers / "healthy" → **grow**.
- Lecture player chrome, the bot's cited data, VPD/DLI gauges → **accent**.
- Genetics/breeding coursework, DNA labs → **violet**.
- All backgrounds, cards, rails, dividers → **ink**.

## Cross-links
- Component spec built on these rules: `docs/research/university/figma-university-design-system.md` (D2)
- Code source of truth: `web/tailwind.config.ts` · `web/src/app/globals.css` · `web/src/components/ui/`
- Accessibility standard: `docs/memory/design/07-university-phase-2.md` §10
- Master plan/ledger: `docs/research/university/IMMERSIVE_UNIVERSITY_MASTER_PLAN.md`
