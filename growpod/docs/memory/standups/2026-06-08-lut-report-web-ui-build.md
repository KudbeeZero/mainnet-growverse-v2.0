# 🛰️ LUT Report — 2026-06-08 Web UI Build Round Table

**Covers:** the web-client build session (2026-06-08, after the EOD design-codex report) · **Repo:**
KudbeeZero/GROWv2 · **Branch:** `claude/growv2-web-ui-build-MZWZE` (off `main`)
**Health at a glance:** ✅ **web typecheck green** (`tsc --noEmit`) · ✅ **ESLint green** (0 warnings)
· ✅ **`next build` green — 18 routes compiled** · ✅ **live-API contract smoke passed** against a
seeded backend on :10000 · backend suite unchanged (UI-only session).

> Format: every specialty that moved speaks (what shipped / what it's watching), then we note what's
> **deferred**, what's **next**, the **captured ideas** from the owner, and the **memory layers**.
> Snapshot in time — a sibling to the morning + EOD reports, not an edit of them (memory rule #5).

---

## 0) One-paragraph summary for the person who skips standups
The EOD report gave the moat a *vision spine*; this session gave it a **face**. We turned the
already-scaffolded `web/` (Next 15 · TS · Tailwind · React Query) into a cohesive, premium,
**research-instrument UI** covering all seven screen groups, and we made the design codex's signature
visual language **real**: a hand-rolled, dependency-free **`<Constellation>`** Canvas engine that
renders DNA, breeding crosses, and the GenBank as glowing force-directed particle clouds — exactly
the cannabis-leaf-as-particles brand the owner shared (NODES readout, DRAG·SCROLL·LIVE PARTICLES).
We wired the previously-unsurfaced backend: **scientist readouts** (VPD gauge + DLI/PPFD), the **AI
Master Grower** advisor + guarded auto-care, the strain **encyclopedia + provably-fair
provenance/lineage**, the **Cannabis Cup** (current/standings/enter/Hall of Fame), and **GrowPod
University** (catalog → enroll → study-timer → practical → complete, degrees, and the AI Professor's
lecture reader), plus a **Profile** with lifetime titles. Typecheck/lint/build are green and the wire
contract was verified field-by-field against a live, seeded backend.

---

## 1) Round table — what shipped this session

**🖥️ Web / Frontend** — The bulk of the session. **Design system:** new tokens (accent/violet,
per-rarity hex ramp, glow shadows, `.instrument-label`/`.panel`/`.canvas-dark`), system-font stacks
(offline/CSP-clean), and a shared UI kit (`Tabs`, `Gauge`, `Metric/MetricGrid`, `ProgressRing`,
`Countdown`, `Pills` — Rarity/Severity/Urgency/Verify/Title/Department, `PageHeader/Section`,
`States`). **The motif:** `components/viz/Constellation.tsx` — one Canvas 2D component, two modes
(`leaf` brand hero, `graph` force-directed) feeding genome/lineage/GenBank via `graphAdapters.ts`.
**IA:** nav → Grow · Lab · Market · Cup · University · Leaderboards · Profile. **Screens:** branded
onboarding hero; dashboard + plant cards with live VPD/DLI/PPFD; plant detail with the advisor panel;
strain detail (Encyclopedia / DNA constellation / Lineage pedigree / Verify provenance); breeding
with parent→child constellation crosses; the GenBank galaxy; market (Fixed/Auctions/Contracts);
the Cup + Hall of Fame; University catalog/transcript/course + lecture reader; Profile (titles,
wallet/ledger, achievements, harvest vault). **Data layer:** new API modules (`cup`, `university`,
`advisor`, `harvests`), extended `strains`/`plants`, new types + query hooks + a
`useApiMutation` helper (invalidate + toast). *Watching:* no Playwright e2e yet; constellation is
node-capped for perf; `/account` + `/contracts` remain as unlinked legacy (superseded by Profile +
Market tab).

**🧱 Backend / API** — No code changes — the contract was already complete. This session **consumed**
71 endpoints and **verified** the new surfaces live: `/strains/<id>/{knowledge,provenance,lineage}`,
`/cup/*`, `/university/*`, `/players/<id>/plants/<id>/{state,advisor}`. *Watching:* a few shapes the
UI leans on are loosely typed server-side (knowledge KB is free-form, hall-of-fame is a bare list) —
fine, but worth an OpenAPI body schema someday.

**🌱 Simulation** — Phase A's payoff became visible: the `/state` `metrics` block
(`vpd_kpa/dli_mol/ppfd/photoperiod_hours`) now drives a **banded VPD gauge** and DLI/PPFD readouts on
every plant card + detail view — the "research instrument, not a cartoon farm" target. *Watching:*
metrics are null-safe in the UI (Phase B variables will slot into the same `MetricGrid`).

**🧬 Genetics** — The codex's "anywhere you see DNA, render the constellation" is now literal: a
strain's 13-trait genome renders as a star constellation (expressed alleles = luminous violet hubs),
a cross merges two parent clouds into a child cloud, and the **verifiable pedigree** renders as a
force-directed family tree with per-node ✓ replay badges. The GenBank galaxy maps every cultivar with
parent→child edges. *Watching:* genome trait count is whatever the backend returns; layout is capped
at ~140 nodes for the galaxy.

**⛓️ Chain / Algorand** — Surfaced the existing mock seams: NFT badges on minted strains/harvests,
mint buttons (strain + harvest), and an Algorand-address link field on Profile. *Watching:* all mint
paths are mock until Sprint 4's funded TestNet — the UI already shows `nft_status` honestly.

**🤖 AI (Master Grower)** — Two player-facing surfaces shipped: the **Advisor panel** (lazy,
on-demand diagnosis — severity pill, grounded diagnosis, ordered suggestions with urgency) and
**guarded auto-care** (budget + 5-action cap; spends post to the ledger). The **AI Professor** lecture
reader renders title/summary/content/takeaways/quiz with a beginner→advanced level selector and
optional live-plant context. Provider label (`mock` / `claude:…`) shown for honesty. *Watching:*
mock provider in CI; real Claude behind the `ai/` seam in prod.

**💰 Economy / Ledger** — Every spend path is wired through the standard mutation helper with proper
query invalidation: tuition (enroll), cup entry fee, breeding/stabilize, seed/market buys, auto-care,
cure/sell/mint, daily stipend, achievement + contract rewards. The Profile ledger table shows every
GROW movement, newest-first. *Watching:* amounts render as-is from the API (Decimal-on-wire as float).

**🏆 Product / LiveOps** — Two new pillars are now playable end-to-end in the UI: the **seasonal
Cannabis Cup** (enter a harvest → deterministic score → standings → lifetime Hall of Fame + champion
trophy strain) and **GrowPod University** (earned degrees with real-time study + practical gating +
prestige titles surfaced on Profile). The owner also dropped two strong growth ideas this session
(see §3b).

**🧪 QA / Testing** — Verification was done **against a live, seeded backend**, not just types: booted
`server.py` on :10000, seeded 22 strains, and asserted the JSON shape of player (titles present),
strain knowledge/provenance/lineage, genome (13 traits × {value,dominance}), cup/current + hall-of-
fame, university catalog + transcript (incl. `progress`/`practical`), `/state` metrics, and advisor
(+ suggestion shape). All matched the hand-written client types. *Watching:* no automated e2e — this
was a manual contract smoke; a Playwright pass over the full loop is the obvious next gate.

**⚙️ DevOps / CI** — Web CI gate (lint + typecheck + build) is **green locally**; `next build`
compiles all 18 routes. No new dependencies added (the constellation is hand-rolled to respect the
strict CSP and keep the bundle lean — first-load JS stays ~102 kB shared). *Watching:* CI today is
lint/typecheck/build only; no runtime/e2e stage.

**🛡️ Security** — Honoured the existing hardening: writes inject `X-API-Key` from localStorage via
the typed `apiFetch` only; the constellation is pure Canvas (no `eval`, no CDN — satisfies
`script-src 'self'`); fonts are system stacks (`font-src 'self'` clean). The one-time API-key reveal
flow on signup is preserved. *Watching:* API key lives in localStorage (XSS-exposed by design;
mitigated by CSP) — unchanged from the scaffold.

**📚 Docs / Memory** — This report (Layer 4). Two owner ideas captured into BACKLOG (Layer 3, 🟡).
No invariant/contract changed, so Layers 0/1 are untouched (memory rule: UI-only ⇒ no invariant
edits). *Watching:* `make check-memory` should stay green — no ✅ claims cite missing paths here.

---

## 2) ⚠️ What's deferred — honest gaps
1. **No Playwright e2e.** Verification was a thorough *manual* live-API contract smoke. The full
   click-through loop (create → grow → advise → harvest → cure → cup → degree) isn't automated yet
   (already on BACKLOG 🟠 as "web e2e smoke").
2. **Legacy pages linger.** `/account` and `/contracts` still exist and build, but nav now routes to
   **Profile** and the **Market → Contracts** tab. They should be redirected or removed next pass.
3. **Constellation is perf-capped.** The galaxy caps at ~140 nodes and the layout is an O(n²)
   spring step — fine for now, needs spatial partitioning before the GenBank gets large.
4. **Fonts are system stacks.** `next/font` was dropped to avoid a build-time Google Fonts fetch that
   the sandbox could block; the premium look rides on the constellation + color, not a webfont. A
   self-hosted display font can be added later with no design change.
5. **Chain + AI are mock-backed** (unchanged): mint/auto-care/lecture show real `nft_status`/provider
   labels but resolve against mocks until the prod keys/TestNet land.

---

## 3a) 🎯 Next (backlog is the source of priority)
- **Playwright e2e** over the core loop + the new Cup/University flows (turn the manual smoke into CI).
- **Retire `/account` + `/contracts`** (redirect → `/profile` and `/market`).
- **Constellation polish:** spatial hashing for the galaxy, an optional animated "cross merge"
  tween on breed, and a static thumbnail variant for cards.
- **Wire `nft_status: pending`** polling once minting is real.

## 3b) 💡 Captured owner ideas (this session) — parked in BACKLOG 🟡
- **Education-gated Master Grower knowledge.** Tie advisor depth + unlocks (tips/tricks, **rare bio-DNA
  traits**, breeding **pollen**, "DNA-in-the-seed") to the player's University progress. *Why it fits:*
  degree perks already use the research effect-key system, the advisor is provider-pluggable, and the
  genome/seed/mint primitives exist — this is a *composition* of shipped systems, not new infra.
  Strongest as: degrees raise an advisor "knowledge tier" + unlock breeding consumables (pollen/trait
  catalysts) that bias the (still provably-fair, seeded) cross.
- **Sponsored / branded content as revenue.** Real cannabis brands sponsoring strains, branded
  equipment/pods, and promotions — using the on-chain asset layer to sidestep traditional ad/banking
  restrictions. *Why it fits:* strains/equipment are already first-class assets; a "sponsored cultivar"
  is a GenBank entry with verifiable provenance + a brand tag. Needs a content/partner model + a
  no-dark-patterns guardrail (ties into the trust layer's charter). Business/LiveOps track.

---

## 4) 🧠 Memory layers
| Layer | File | Role |
|------|------|------|
| 0 | `CLAUDE.md` | Always-loaded identity + invariants + how to work |
| 1 | `docs/memory/ARCHITECTURE.md` | System map + the "don't break" list (where we are) |
| 1+ | `docs/memory/design/` | **Design Codex** — vision/intent; the genetic-constellation signature language this session made real |
| 2 | `docs/memory/DECISIONS.md` | Append-only "why" log (ADRs) |
| 3 | `docs/memory/BACKLOG.md` | Prioritized work — now / medium / low (two owner ideas added 🟡) |
| 4 | `docs/memory/standups/` | Dated LUT reports (this file) |

---

*Prepared after a full web-client build session — design system + the `<Constellation>` motif + all
seven screen groups wired to the API, verified green (typecheck/lint/build) and contract-checked
against a live seeded backend. — Standup compiled by Claude Code on branch
`claude/growv2-web-ui-build-MZWZE`.*
