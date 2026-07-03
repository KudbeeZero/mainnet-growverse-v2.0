# 📒 Canonical Project State — Records Department source of truth

> **⚠️ SNAPSHOT (2026-06-14, post-PR #46)** — this "live" ledger is frozen at that date. Current project state is in `docs/HANDOFF.md` (baton) and `docs/memory/BACKLOG.md`. The code always wins over this file.

> **Authoritative records ledger** (per the Director's REC-004 decision, 2026-06-14): the consolidated,
> point-in-time picture of *what exists* — PRs, branches, directives, the launch critical path, and
> department status — reconciled against `main`. It complements the live baton (`docs/HANDOFF.md`),
> the prioritized backlog (`docs/memory/BACKLOG.md`), and the **live** cross-agent coordination roster
> `docs/STUDIO_AGENT_REGISTRY.md` (REC-003). Division of labour: the **registry** is air-traffic
> control for *in-flight* work (who owns which file surface right now); **this file** is the
> *snapshot* of settled record. When this file and the code disagree, **the code wins** — fix this file.
>
> **Maintenance:** refresh on the next full sweep or when a milestone materially changes the picture;
> cite PRs by GitHub number. Routine churn belongs in BACKLOG (priority) and the dated standups.

**Reconciled:** 2026-06-14 · **Against:** `main` (post-#46) · **By:** REC-004 (Records Department)

---

## 1) Canonical Project State (one screen)

**GROWv2 / GrowPod Empire** (`growpodempire`) — a cannabis-growing game: persistent ledger economy,
real strain genetics/crossbreeding, a server-authoritative compute-on-read grow simulation, an
Algorand on-chain asset layer (mock in CI; real settlement deferred to Sprint 4), and an AI "Master
Grower" advisor. Backend Python/Flask; web client Next.js 15 in `web/`.

| Dimension | State today |
|-----------|-------------|
| **Phase** | New-Player / **Launch-Readiness** track. Backend foundation (Phases 1–3) + Sprints 1–3 shipped; the Graphics Phase + Dashboard wiring are **done and signed off**; the **FTUE epic** is merged; DX polish (mobile nav, care feedback, primary CTA) is landing. |
| **Core loop** | grow → care → harvest → cure → sell/breed/stabilize → mint → trade — intact and test-covered. |
| **Strain catalog** | **29 strains** in `data/strains.yaml`, each with a 1:1 encyclopedia entry in `data/strain_knowledge.yaml` (sync enforced by test). |
| **Web client** | All seven screen groups + grow chamber (whole-plant + macro), `/ftue` guided tutorial, mobile-first responsive nav, care-feedback/celebration, primary plant CTA. |
| **Chain / real value** | **Not live.** Mock provider only; real TestNet settlement is a Sprint-4 gate (carried RISK #4/7). |
| **Governance** | OMNI Charter v1.0 (`docs/OMNI_CHARTER.md`) + Studio Agent Registry (`docs/STUDIO_AGENT_REGISTRY.md`, REC-003) + Session Relay Protocol (`docs/SESSION_PROTOCOL.md`) in force. |
| **Gates** | `make test` / `make lint` / `make check-memory` / `make check-migrations` green on `main` (single Alembic head). Web `tsc`/`lint`/`build`/`vitest` green. Playwright e2e still a stub (RISK #8). |

---

## 2) PR Ledger

GitHub repo `kudbeezero/growverserepelitv1`. **Two number drifts to watch:** (a) some PR *titles* carry
an internal "PR #N" label ≠ the GitHub number (the sequence skipped ahead when parallel sessions
opened #27/#28); (b) **"DIR-004" (a Design directive, FP-3 plant CTA, PR #45) is NOT "REC-004"
(this Records sweep)** — different directives, colliding numbers. GitHub number is authoritative.

### Merged to `main` (history)
| GH # | What landed |
|------|-------------|
| 1–17 | Foundation + Sprints 1–3 + hardening: Replit onboarding (#1), plant timeline (#2), Session Relay Protocol/CI gates (#3), strain encyclopedia (#5), bomb-squad/fleet hardening (#6/#8/#10), concurrency+wallet lock (#9), API-validation 500→400 (#11), Grow Chamber WIP reconcile (#12), terpene→effect engine (#14), GROVERS v2 hero (#15), delegation charter (#17). |
| 18 | Detailed Bud View overhaul + first 3 launch strains (G13, Purple Diddy Punch, Animal Mints). |
| 19 | Whole plant: denser flowering skeleton + per-strain silhouette. |
| 21 | Marketplace optimistic lock on auctions + pre-launch sweep. |
| 22 | Launch cleanup: de-flake + per-plant seed + matte de-gloss + **vitest in CI**. |
| 24 | Per-strain fan-leaf morphology. |
| 25 | De-Grape whole-plant buds (continuous bud-mass silhouette). |
| 26 | Bud Weight Physics polish — **carried the Canonical Stage PNG / `chamberCore` extraction** (internal "#29"). |
| 29 | Dashboard / GameState wiring polish (titled "PR #30"); flat `/state` stays canonical; `AuthErrorListener` (clears RISK #10). |
| 33 | Launch Strain Integration Pack — White Rhino, White Fire OG, Gelato, Wedding Cake (catalog → 29). |
| 34 | FTUE starter-grant rail — pod + seed on signup (one-shot, idempotent). |
| 35 | FTUE deterministic guided tutorial (backend) + AI Master Grower coaching. |
| 36 | DXD Mobile-first: responsive nav (bottom tab bar) + responsive Grow Chamber. |
| 38 | OMNI Charter v1.0 organizational constitution. |
| 39 | Web `/ftue` guided tutorial route. |
| 41 | DX-001 Care Feedback & Celebration (rewarding care + harvest moment, reduced-motion safe). |
| 43 | FTUE-epic closeout docs (baton/BACKLOG/DECISIONS rewrite + FTUE standup) — **owner-merged 10:09 UTC; superseded by REC-004**. |
| 45 | "DIR-004" / FP-3 Primary Plant CTA (next action always visually primary). |
| 46 | REC-003 Studio Agent Registry (`docs/STUDIO_AGENT_REGISTRY.md`) + OMNI Charter registry section. |

### Open (active / parked — do NOT autonomously merge)
| GH # | Branch | State | Note |
|------|--------|-------|------|
| 27 | `…phenotype-generator-foundation-h4ii5y` | **PARKED** (green) | Do not modify. |
| 28 | `…circadian-leaf-motion-q7w2n8` | **PARKED** (green) | Do not modify. |
| 32 | `claude/mvp-e2e-grow-loop` | OPEN | Deterministic E2E grow-loop CI (titled "PR #31"). Relates to RISK #8. |
| 42 | `…growpod-mvp-launch-planning-4n2ps4` | OPEN | **MVP Feature Flag Layer** — the "Feature Flags" critical-path NEXT ACTION; audit & land, don't rebuild. |

### Closed without merge (superseded / abandoned / retired)
| GH # | Why |
|------|-----|
| 4, 7, 13, 20, 23 | WIP superseded by their rebased/follow-up PRs (#12, #14, #22, etc.). |
| 16 | Idempotency-Key replay WIP — never merged; general `Idempotency-Key` header remains carried RISK #3. |
| 30 | Canonical Stage PNG Generation — the work **landed via #26**; this PR closed unmerged. |
| 31 | Launch Strain Integration Pack (first cut) — superseded by #33 (merged). |
| 37 | Grow Guide FTUE coach — **retired**, superseded by the FTUE epic (#35/#39). Ideas salvaged: game-state-driven/non-nagging progression (REC-003 registry) + backend WO-1/WO-2 (BACKLOG). |
| 40 | Mobile bottom nav (FP-1) + FP-3 — **retired**; FP-1 superseded by #36, FP-3 re-cut as #45. |

---

## 3) Branch Ledger — verified stale-branch report (REC-A09)

> **Re-verified 2026-06-14 (post-REC-004, REC-005 audit):** the prune has **NOT yet been executed** —
> all vetted targets still exist on the remote. Two reclassifications since the snapshot below:
> **`simulation-test-clock-u4ounm`** → now **MERGED** (PR #47) → safe to prune (was wrongly listed as
> closed-unmerged); **`heygen-hyperframes-install-o52fxi`** → now has **OPEN PR #56** → **EXCLUDE**.
> **`growpod-university-curriculum-4f6xnd`** → now safe (Master Bible merged via PR #53). Several
> post-snapshot branches (`be-feature-flags-core` #55-merged, `dx-007-closeout`, `dx-*`,
> `be-003-feature-flags-reconcile` this PR, etc.) are **not** in the list and must not be pruned
> unless verified merged with no open PR. A full §3 list refresh should run immediately after the
> owner executes the prune.

`main` is the trunk. ~54 `claude/*` + `session/*` branches exist on the remote; most are **merged or
superseded** and are safe to prune. Each prune candidate below was verified against the PR ledger
(represented on `main` or explicitly closed) and the open-PR list (no active PR depends on it).
**Pruning is the owner's to execute** — destructive git is denied to agents (`.claude/settings.json`)
and the Director scoped REC-004 to *recommendations*. This is the recommendation.

- **KEEP — live / do-not-touch:** `main`; `claude/phenotype-generator-foundation-h4ii5y` (#27 parked);
  `claude/circadian-leaf-motion-q7w2n8` (#28 parked); `claude/mvp-e2e-grow-loop` (#32 open);
  `claude/growpod-mvp-launch-planning-4n2ps4` (#42 open); `claude/repo-memory-reconciliation-frcgap`
  (REC-004, this branch).
- **PRUNE — merged (work is on `main`):** `plant-stage-timeline`, `session-relay-protocol-ybubw7`,
  `fleet-audit-hardening`, `concurrency-idempotency-hardening`, `api-validation-hardening`,
  `night-shift-2026-06-10`, `terpene-effect-engine`, `grovers-particle-leaf-i1s759`,
  `planning-session-4v29n1`, `plant-structure-audit-1vfkgv`, `code-review-error-sweep-7h57k6`,
  `deflake-forecast-test`, `leaf-morphology-per-strain`, `de-grape-whole-plant-buds-8zrsnb`,
  `bud-weight-physics-polish-7daxpa`, `dashboard-gamestate-wiring-90io9r`, `launch-strains-catalog`,
  `ftue-starter-grant`, `ftue-tutorial-flow`, `growpod-design-director-8lya2y`,
  `growpod-empire-constitution-oqtzqk`, `web-ftue-route`, `dx-care-feedback-celebration` (#41),
  `dx-plant-cta` (#45), `records-agent-registry` (#46), `closeout-ftue-epic` (#43),
  `merge-bomb-squad-6`.
- **PRUNE — closed-unmerged / abandoned (no PR or superseded):** `grow-chamber-plants-6ud1q4`,
  `grovers-night-shift-cm59p1`, `terpene-effects-economy`, `night-shift-pexjg3`,
  `stage-reference-visual-polish`, `launch-strain-integration-pack` (first cut),
  `growpod-stage-png-export-0u8ss3`, `growpod-dxt-mission-m9qt54` (#37 retired),
  `dxt-sprint03-mobile-ux` (#40 retired), `bomb-squad-defects-un7ldl`, `cannabis-growth-engine-s114yu`,
  `cannabis-strain-research-nmb3cf`, `growpod-obsession-lab-oyei9z`,
  `growpod-university-consolidation-mujr51`, `growpod-university-curriculum-4f6xnd`,
  `growpod-university-curriculum-m2vp2m`, `growpod-university-curriculum-n9ppeq`,
  `growpod-university-framework-jclid8`, `heygen-hyperframes-install-o52fxi`,
  `multi-agent-stranger-outreach-rxsgjs`, `simulation-test-clock-im20ah`,
  `simulation-test-clock-u4ounm`, `session/local-bringup`.

---

## 4) Directive Ledger

Two directive families share a number space — **REC-** (Records) and **DIR-/DX-** (Design &
Experience). Reconstructed from PR titles/commits + the OMNI Charter; live in-flight detail is in
`docs/STUDIO_AGENT_REGISTRY.md`.

| ID | Title | Source | Status |
|----|-------|--------|--------|
| — | Session Relay Protocol (one-chat-one-PR + audited handoff) | `docs/SESSION_PROTOCOL.md` (PR #3) | ✅ in force |
| — | Owner delegation charter + end-of-chat report | `CLAUDE.md` (PR #17) | ✅ in force |
| OMNI v1.0 | Organizational constitution | `docs/OMNI_CHARTER.md` (PR #38) | ✅ in force |
| DX-001 | Care Feedback & Celebration | PR #41 | ✅ merged |
| DX-003 | FTUE epic (guided first grow) | PRs #34/#35/#39 (+ closeout #43) | ✅ delivered |
| DIR-004 | FP-3 Primary Plant CTA (Design) | PR #45 | ✅ merged |
| REC-003 | Studio Agent Registry (live coordination roster) | PR #46 (`docs/STUDIO_AGENT_REGISTRY.md`) | ✅ in force |
| **REC-004** | **Full Repository Memory Reconciliation Sweep** | this directive | ✅ this sweep (authoritative records) |
| BE-002/004 | Simulation Test Clock + e2e Grow Loop + HTTP-boundary coverage | PR #47 | ✅ merged |
| UNI-003/004/010/011 | GrowPod University Master Bible (records; ❄️ frozen post-MVP) | PR #53 | ✅ merged |
| BE-003 | Feature Flags — backend core (data-driven, balance.yaml) | PR #55 | ✅ merged |
| BE-003 (recon) | Feature-flag de-dup: collapse #42's config path into the balance.yaml-canonical system | this PR | 🔨 open (cleanup) |

---

## 5) Launch Critical Path

```
Feature Flags (PR #42 open — audit & land)
   → Mobile Polish (PR #36 ✅ nav+chamber; #41 ✅ care feedback; #45 ✅ primary CTA;
                     remaining: small-screen sweep of dashboard / PDP / /ftue)
      → Playtesting
         → Retention Validation
            → MVP Launch Candidate
```

- **Off-chain MVP first** (charter principle): real TestNet settlement / IPFS (Sprint 4) is *after*
  the MVP, gated by carried RISK #4/7.
- The aspirational `GameState/EnvironmentState/UIState` aggregate is **not** on the path — the flat
  `GET …/plants/<id>/state` wire is canonical (DECISIONS 2026-06-14).

---

## 6) Department Status (per OMNI Charter)

| Department | Status |
|------------|--------|
| **Executive** | OMNI Charter v1.0 + REC-003 registry + delegation charter in force. |
| **Engineering — Backend** | ✅ Phases 1–3 + Sprints 1–3 shipped, test-backed. Carried: idempotency header (#3), chain settlement (#4/7). |
| **Engineering — Simulation** | 🔨 Phase A (VPD/DLI) + sim-cost-cap/dormancy shipped; Phase B ⬜. Dormancy *semantics* carried as RISK #9. |
| **Engineering — Frontend / Dashboard** | ✅ full UI + chamber + `/ftue` + primary plant CTA (#45) + care feedback (#41); flat `/state` wire canonical; 401/403 handler shipped (RISK #10 cleared). |
| **Engineering — Strain Integration** | ✅ 29 strains, 7 with authored chamber visuals; rest derived. |
| **Design & Experience** | 🔨 Mobile-first nav (#36) + FTUE (#34/#35/#39) + care feedback (#41) + primary CTA (#45) shipped; remaining small-screen polish sweep. |
| **Quality** | ✅ backend suite + coverage + memory/migration gates green; ⬜ Playwright e2e stub (RISK #8); ⬜ load/soak on `/state`. |
| **Product** | ✅ daily stipend + achievements + Cannabis Cup + University; 🔨 retention validation pending; fiat rail parked. |
| **Operations** | ✅ memory integrity enforced; REC-003 registry (live coordination) + REC-004 (this consolidation) are the Reconciliation function. ⬜ secrets hardening before real value. |

---

## 7) Carried risks (authoritative copy lives in `docs/HANDOFF.md`)

RISK #3 (general `Idempotency-Key` header) PARTIAL · RISK #4/7 (real chain settlement) OPEN ·
RISK #8 (web Playwright e2e stub) PARTIAL · RISK #9 (sim dormancy semantics) OPEN · RISK #11
(rate-limiter `memory://`, public `get_level`) PARTIAL. **Cleared:** RISK #10 (web 401/403 handler —
shipped in PR #29/#30). A risk clears only when **verified fixed, test-backed**.
