# GrowPod Empire — Studio Agent Registry (REC-003)

> **Air-traffic control for the studio.** The [OMNI Charter](OMNI_CHARTER.md) defines *who may
> build what*; this registry tracks *who is building what right now* — live branch/PR ownership,
> the file surfaces each directive touches, and the rules that stop two agents from colliding on
> the same surface. It governs **coordination**; `CLAUDE.md` + `docs/memory/` govern the **code**.
>
> **Maintainer:** Records Department · **Authority:** Studio Director (Mission Control)
> **Last updated:** 2026-06-14 (REC-004 — Orchestration & Work Order Coordination added; `AGENT_ORCHESTRATION_LEDGER.md` is now a protected surface)

---

## Why this exists

On 2026-06-14 three parallel directives shipped overlapping work onto the same file surfaces
(navigation, FTUE, app shell) without knowing the others existed — producing duplicate
implementations and stale PRs (see **Collision Log** below). The fix is not "fewer agents"; it is
**a shared roster every agent checks before building.** Parallel work is safe when ownership of a
surface is explicit.

---

## Pre-work checklist (every agent, before writing code)

1. **Check this registry** — is any active directive already touching your file surfaces?
2. **Verify the feature doesn't already exist** — grep `main` and scan the *Recently merged* list
   below before building. (DX-005 set out to build FP-5; it was already merged in #41 — this step is
   why no duplicate shipped.)
3. **Claim your surfaces** — add a row to the Live Assignment Ledger (Directive, branch, surfaces).
4. **Rebase onto `main`** — never build on a stale base; `main` moves under you.
5. **Verify no active directive owns the same files** — if one does, STOP and escalate to the
   Director. Do not build on a [Protected Surface](#protected-surfaces) without Director approval.
6. **Keep PRs small; stop at PR creation / the natural checkpoint** — one responsibility per PR.

> **No autonomous merges. No autonomous rebases of someone else's branch. No mutations without
> approval.** (OMNI Charter, Core Rules.)

### Operational note — workflow transition (2026-06-14)

The studio is moving toward **desktop + terminal operations**: the Director will increasingly drive
the repo through **Claude Code / terminal-based repo control**, while ChatGPT / Grok / Claude
continue to act as specialized studio departments. Going forward every agent assumes terminal-first
repo control and follows the pre-work checklist above before any new work.

---

## Protected surfaces

These are high-traffic, shared surfaces where collisions are most damaging. **No two agents may
build on the same protected surface concurrently without explicit Director approval.** Serialize.

| Surface | Representative paths |
|---|---|
| Navigation | `web/src/components/layout/NavBar.tsx`, `MobileTabBar.tsx`, `navLinks.ts` |
| FTUE / Onboarding | `web/src/app/ftue/**`, `web/src/components/onboarding/**`, FTUE libs |
| App Shell | `web/src/components/layout/AppShell.tsx` |
| Root Layout | `web/src/app/layout.tsx` (metadata/viewport), `globals.css` |
| Global State | session/store providers (`web/src/lib/session.tsx`, `lib/localStore.ts`, providers) |
| Simulation engine | `simulation/**` (server-authoritative; backend WO required) |
| Ledger / economy | `services/**`, `db/models.py` (backend WO required) |
| **Feature-flag infra** | `feature_flags.py`, `data/balance.yaml` (`feature_flags:`), `GET /api/game/flags`, `feature_required` route gates, web `features.ts`/`RequireFeature`. **Single-writer** — canonical = `balance.yaml`/`feature_flags.py` (PR #63, CEO-ratified). There must be exactly ONE flag system; do not add a second source of truth or resurrect `feature_gates.py`/config `FEATURE_*`. |
| **Orchestration ledger** | `docs/AGENT_ORCHESTRATION_LEDGER.md` (REC-004) — the canonical employee/sub-agent roster + Work Order log. Single-writer; coordinate before editing. |

---

## Live Assignment Ledger

Open / in-flight directives. One row per directive; update **Status** as it moves.

| Directive | Dept | Lead | Workers | Branch | PR | Owned file surfaces | Deps | Status |
|---|---|---|---|---|---|---|---|---|
| DX-007 (P2 FTUE Coach-Marks) | Design & Experience | DX-A00 | DX-A01–A10 | `claude/dx-ftue-coach-marks` | (this PR) | FTUE/Onboarding (coach-mark layer): `components/onboarding/CoachMarks.tsx` (new), `lib/coachMarks.ts` (new), `lib/coachMarkStore.ts` (new), + `data-coach` tags & mount in `app/dashboard/page.tsx` | Builds **on top of** canonical FTUE (#35/#39) — does not modify the `/ftue` route. New layer; no overlap with the merged plant-care work. | 🟢 Open |
| **FF-RECON-001 (Feature Flag Reconciliation)** | Builder | — | — | — | #63 | flag layer (`feature_flags.py`, `balance.yaml feature_flags:`, `GET /api/game/flags`, `feature_required` route gates) | — | ✅ **EXECUTED** — **PR #63** collapsed to one **`balance.yaml`-canonical** system (gated ~25 routes via `feature_required`, route-gate==`/flags` regression test); #42's `feature_gates.py` + config `FEATURE_*` removed. **CEO 2026-06-14 ratified #63**; the competing #61 (delete #55) **closed superseded**. *Deferred (not now, no defect): the web layer still reads build-time `NEXT_PUBLIC_ENABLE_*` — a future runtime `useFlag` over `/api/game/flags` could unify it, but is out of scope per CEO (focus → Playtesting).* |

### Recently merged to `main` (for collision awareness)

| PR | Title | Surfaces touched |
|---|---|---|
| #48 | DX-006 Sticky One-Handed CTA | Plant-care placement (`StickyActionBar`, plant detail) |
| #49 | DX-005 FP-5 completion — primary CTA celebration | Plant-care (`PlantActionCTA`) |
| #46 | Studio Agent Registry (REC-003) | docs (governance) |
| #45 | Primary Plant CTA (FP-3, re-cut) | Plant-care |
| #41 | Care Feedback & Celebration (DX-001 = **FP-5**) | Plant-care (`careFeedback`, `CareFeedback`, `haptics`, wired into `CareButtons`) |
| #39 | `/ftue` guided tutorial route | FTUE |
| #38 | OMNI Charter v1.0 | docs (governance) |
| #36 | DXD Mobile-first — responsive nav + chamber | **Navigation**, App Shell, Layout, chamber |
| #35 | Deterministic guided tutorial + AI Master Grower | **FTUE** |
| #34 | FTUE starter-grant rail (pod + seed on signup) | backend grant + onboarding |

### Parked (open, green — do NOT modify)

| PR | Title | Owner |
|---|---|---|
| #27 | Phenotype Generator Foundation | Graphics (parallel session) |
| #28 | Circadian Leaf Motion | Graphics (parallel session) |

### Retired (closed without merge)

| PR | Title | Reason |
|---|---|---|
| #40 | Mobile bottom nav (FP-1) + FP-3 | FP-1 superseded by #36; FP-3 re-cut as #45 |
| #37 | Grow Guide FTUE coach | Superseded by canonical FTUE (#35 + #39) |

---

## Collision Log

| Date | Collision | Resolution |
|---|---|---|
| 2026-06-14 | Two mobile bottom-nav implementations (PR #40 `BottomNav` vs merged #36 `MobileTabBar`) on the **Navigation** surface | DIR-004: retire #40's FP-1; keep #36. |
| 2026-06-14 | Two FTUE systems (PR #37 `GrowGuide` vs merged #35/#39 guided tutorial) on the **FTUE** surface | DIR-004: close #37; salvage ideas to backlog (below). |
| 2026-06-14 | DX-005 set out to build FP-5 (Care Feedback & Celebration) — but the pre-work registry/flight-plan check found **#41 already shipped it**. | **Registry working as designed**: no duplicate built. DX-005 scoped down to wiring the new primary CTA (#45) into the existing #41 feedback system — the one surface #41 couldn't have known about. |
| 2026-06-14 | **Two feature-flag systems on `main`:** System A (PR #42 — config `FEATURE_*` + `feature_gates.py`, web `features.ts`/`NEXT_PUBLIC_ENABLE_*`, defaults OFF) vs System B (BE-003 / #55 — `feature_flags.py` + `balance.yaml` + `GET /api/game/flags`, fail-closed). Two chats then drove **opposite** reconciliations in parallel: **PR #63** (keep B/`balance.yaml`, delete A) and **PR #61** (keep A, delete B). | ✅ **RESOLVED (FF-RECON-001 EXECUTED).** PR #63 merged first → **`balance.yaml`/`feature_flags.py` is canonical**; #42's `feature_gates.py` + config `FEATURE_*` removed; ~25 routes gated via `feature_required` with a route-gate==`/flags` regression test. **CEO 2026-06-14 ratified #63**; **PR #61 closed as superseded** (no revert of #63). Lesson: neither flag effort claimed the surface at branch time → both a duplicate *and* two contradictory fixes shipped. |

**Salvaged from #37 (archived to `docs/memory/BACKLOG.md`):** persistent per-player tutorial state,
non-nagging dismissal, and game-state-driven (auto-advancing) progression.

---

## Agent slot index

Slots are **reusable work-lanes / roles**, not always-on processes. A slot is "staffed" only while
a directive assigns it. Format mirrors the OMNI Charter department map.

| Dept | Slots | Notes |
|---|---|---|
| Records (REC) | REC-A01 … A10 | Maintains this registry. |
| Design & Experience (DX) | DX-A01 … A10 | UX/Mobile/Art/Tutorial/Accessibility. |
| Plant Engine (PE) | PE-A01 … A10 | Sim/renderer (server-authoritative; WO for logic). |
| Backend (BE) | BE-A01 … A10 | API/economy/ledger (WO-gated). |
| QA | QA-A01 … A10 | Tests, playtests, performance. |
| Monitoring (MON) | MON-A01 … A10 | Read-only observe → report. |
| Security (SEC) | SEC-A01 … A10 | Defensive only. |
| DevOps (DEVOPS) | DEVOPS-A01 … A10 | CI/release/infra. |
| Research (RES) | RES-A01 … A10 | Think-tank; no mutations. |
| Documentation/Ops (DOC) | DOC-A01 … A10 | Docs, memory, operations. |

### Agent record format (copy when staffing a slot)

```
Agent ID:
Department:
Role:
Status:            ACTIVE | IDLE | BLOCKED
Current Assignment:
Branch:
PR:
Owned File Surfaces:
Dependencies:
Last Update:
```

---

## Rules adopted with REC-003

- **Rebase requirement:** every implementation branch rebases onto `main` before work and before
  push. `main` is shared and moves.
- **Serialization:** the [Protected Surfaces](#protected-surfaces) are single-writer. Claim them in
  the ledger; if already owned, escalate rather than fork.
- **Registry-first:** no implementation directive begins until its surfaces are claimed here.
- **Closeout:** when a PR merges or closes, move its row to Merged/Retired and clear its surface
  claim so the next agent can take it.

---

## Orchestration & Work Order Coordination (REC-004)

This registry governs *file-surface* ownership; the **[Agent Orchestration Ledger](AGENT_ORCHESTRATION_LEDGER.md)**
governs *agent* orchestration — how persistent employee chats deploy ephemeral sub-agents, the
`SA-XXX` audit numbering, and the Work Orders that hand work between chats.

- **Ledger link:** [`AGENT_ORCHESTRATION_LEDGER.md`](AGENT_ORCHESTRATION_LEDGER.md) is the canonical
  roster for employees, sub-agents, and Work Orders.
- **Mandatory WO format:** every handoff uses the 5-field Work Order format defined in the ledger
  (Name/Role · What's Needed · Problem · What Needs to Happen · Prompt for Employee Chat).
- **Protected surface:** the ledger is a single-writer [Protected Surface](#protected-surfaces) —
  coordinate before editing, same as the other shared surfaces.
- **Pre-work tie-in:** spawning sub-agents or opening a Work Order does not exempt an agent from the
  [Pre-work checklist](#pre-work-checklist-every-agent-before-writing-code); claim your file
  surfaces here first, then log the orchestration in the ledger.

> See also: [OMNI Charter](OMNI_CHARTER.md) (org constitution) and `docs/memory/MAP.md` (code↔doc map).
