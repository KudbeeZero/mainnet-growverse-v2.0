# GrowPod Empire — Agent Orchestration Ledger (REC-004)

> **The roster of who-deploys-whom.** Where the [Studio Agent Registry](STUDIO_AGENT_REGISTRY.md)
> tracks *which directive owns which file surface*, this ledger tracks *how persistent employee
> chats deploy ephemeral sub-agents* — the self-deployment caps, the temporary `SA-XXX` audit
> numbers, and the Work Orders that move work between chats. It governs **orchestration**, not code.
>
> **Maintainer:** Records Department · **Authority:** Studio Director (Mission Control)
> **Protected surface:** yes — this file is single-writer; coordinate before editing.
> **Last updated:** 2026-06-14 (REC-004 — ledger created)

---

## Employee Self-Deployment Log

One row per persistent employee chat; update as it spawns or retires sub-agents.

| Employee | Current Sub-Agents Active | Max Allowed | Last Deployment |
|---|---|---|---|
|  |  | 10 |  |

## Active Sub-Agent Registry

One row per *live* sub-agent. Sub-agents are one-and-done; the `SA-#` is logged for traceability
only and the row is cleared when the sub-agent finishes.

| SA-# | Parent Employee | Task | Spawned | Status |
|---|---|---|---|---|
|  |  |  |  |  |

## Completed Sub-Agent Results Log

A lightweight handoff trail: when a sub-agent finishes, its parent employee logs a one-line result
here so the output can be picked up later. Sub-agents stay one-and-done — this is the only trace
they leave once their live row is cleared.

| SA-# | Parent Employee | One-line Summary | Status |
|---|---|---|---|
|  |  |  |  |

_WO-013 complete._

## Work Order Log

One row per Work Order. Update **Status** as it moves (`🟢 Open` / `🔨 Doing` / `✅ Done`).

| WO-# | Assignee | Title | Status |
|---|---|---|---|
| WO-001 | REC-A01 | Create the orchestration ledger | ✅ Done |
| WO-002 | REC-A01 | Employee vs Sub-Agent Rules | ✅ Done |
| WO-003 | REC-A01 | Mandatory Work Order Format | ✅ Done |
| WO-004 | REC-A01 + DX-A01 | Wire ledger into Studio Agent Registry | ✅ Done |
| WO-005 | REC-A01 | Draft self-deployment protocol (WO-006…010) | ✅ Done |
| WO-006 | (employee) | Self-deploy up to 10 sub-agents | 🟢 Open |
| WO-007 | (employee) | Assign SA-XXX audit numbers | 🟢 Open |
| WO-008 | (employee) | Write the "Prompt for Employee Chat" field | 🟢 Open |
| WO-009 | (employee) | Enforce the max-10 sub-agent cap | 🟢 Open |
| WO-010 | (employee) | One-and-done sub-agent logging | 🟢 Open |
| WO-011 | REC-A01 | Populate the Employee Roster | ✅ Done |
| WO-012 | REC-A01 + DX-A01 | UI Surface Integration note | ✅ Done |
| WO-013 | REC-A01 | Completed Sub-Agent Results Log | ✅ Done |
| WO-014 | REC-A01 | Quick-start: spawn your first sub-agent | ✅ Done |
| WO-015 | REC-A01 + MON-A01 | Weekly Orchestration Health Check | ✅ Done |

## Employee Roster

One row per persistent employee chat (a long-term role with cross-session memory).

| Employee ID | Role | Persistent memory? | Notes |
|---|---|---|---|
| REC-A01 | Records — maintains the registry + this ledger | Yes | Orchestration maintainer (REC-004). |
| DX-A01 | Design & Experience — UX / mobile | Yes | Owns DX directives w/ DX-A00 lead. |
| DX-A02 | Design & Experience — art / tutorial | Yes | FTUE / visual surfaces. |
| DX-A03 | Design & Experience — accessibility | Yes | A11y review of UI surfaces. |
| BE-A01 | Backend — API / economy / ledger | Yes | WO-gated; touches `services/`. |
| MON-A01 | Monitoring — read-only observe → report | Yes | Runs the weekly health check (below). |
| QA-A01 | QA — tests / playtests / performance | Yes | Gate keeper for green CI. |
| DOC-A01 | Documentation / Ops — docs + memory | Yes | Memory-layer upkeep. |

_WO-011 complete._

---

## Employee vs Sub-Agent Rules

- **Persistent employee chat = a long-term role with cross-session memory.** An employee keeps
  context across sessions (its baton, its registry rows, its history) and owns a department slot
  such as `REC-A01` or `DX-A01`.
- **Sub-agent = ephemeral, one-and-done.** A sub-agent is spawned for a single task, runs, returns
  its result, and is gone. It is assigned a **temporary `SA-XXX` number for audit only** — the
  number exists for traceability, not as a standing identity.
- **Hard limit: max 10 active sub-agents per employee chat at any time.** Never exceed 10
  concurrently; let one finish before spawning the eleventh.
- **Self-deployment rule:** an employee **may** spawn its own sub-agents, but **must log the `SA-#`
  in this ledger immediately** (Active Sub-Agent Registry + bump its Self-Deployment Log row).
  Clear the row when the sub-agent finishes.

WO-002 complete.

---

## Quick Start: Spawn Your First Sub-Agent

New here? Spawning a sub-agent takes four steps. First, check the **Employee Self-Deployment Log** —
confirm you have fewer than 10 sub-agents live (the [hard cap](#employee-vs-sub-agent-rules)). Second,
grab the next free `SA-XXX` number and add a row to the **Active Sub-Agent Registry** with the task,
*before* the sub-agent runs. Third, hand it a clear task using the 5-field
[Mandatory Work Order Format](#mandatory-work-order-format), ending the prompt with a `complete` line.
Fourth, when it finishes, log a one-line result in the **Completed Sub-Agent Results Log**, mark it
done, and clear its live row. That's the whole loop — see WO-006…WO-010 for the standing protocol.

WO-014 complete.

---

## Mandatory Work Order Format

Every Work Order in GrowPod Empire uses this exact 5-field structure:

1. **Name/Role** — the employee or slot that owns the WO (e.g. `REC-A01`).
2. **What's Needed** — the one-line outcome the WO delivers.
3. **Problem** — why it's needed; the gap or friction it closes.
4. **What Needs to Happen** — the concrete steps / acceptance criteria.
5. **Prompt for Employee Chat** — the paste-ready prompt that hands the WO into a chat, ending
   with a `WO-### complete` line.

All future work orders in GrowPod Empire must use this format.

WO-003 complete – format locked.

---

## UI Surface Integration

Orchestration does **not** override surface ownership. The Grow dashboard and pod views run on the
[Protected Surfaces](STUDIO_AGENT_REGISTRY.md#protected-surfaces) listed in the Studio Agent Registry —
especially **Navigation**, **App Shell**, **FTUE / Onboarding**, and **Global State** — which remain
single-writer. Any employee (or sub-agent) doing dashboard/pod UI work must first **claim those
surfaces in the main Registry's Live Assignment Ledger**, then log the Work Order here. Claiming a WO
in this ledger is never a substitute for the Registry's
[pre-work checklist](STUDIO_AGENT_REGISTRY.md#pre-work-checklist-every-agent-before-writing-code).

WO-012 complete.

---

## Work Orders — Self-Deployment & Handoff Protocol

The standing protocol every employee follows to deploy and log its own sub-agents.

### WO-006 — Self-deploy up to 10 sub-agents
- **Name/Role:** any employee chat.
- **What's Needed:** authority + steps to spawn sub-agents without a Director round-trip.
- **Problem:** employees stall waiting for permission to parallelize one-off work.
- **What Needs to Happen:** spawn 1–10 sub-agents for independent subtasks; never exceed 10 live.
- **Prompt for Employee Chat:** "Spawn N (≤10) sub-agents for these independent subtasks; log each
  before they run. WO-006 complete."

### WO-007 — Assign SA-XXX audit numbers
- **Name/Role:** the spawning employee.
- **What's Needed:** a unique, traceable id per sub-agent.
- **Problem:** un-numbered sub-agents can't be audited after they vanish.
- **What Needs to Happen:** assign the next free `SA-XXX`; record it in the Active Sub-Agent Registry.
- **Prompt for Employee Chat:** "Assign each sub-agent the next `SA-XXX` and log it. WO-007 complete."

### WO-008 — Write the "Prompt for Employee Chat" field
- **Name/Role:** the spawning employee.
- **What's Needed:** a clean, paste-ready handoff prompt per sub-agent/WO.
- **Problem:** vague handoffs lose context and cause rework.
- **What Needs to Happen:** write the prompt in the 5-field format; end it with a `complete` line.
- **Prompt for Employee Chat:** "Draft the paste-ready prompt in 5-field format. WO-008 complete."

### WO-009 — Enforce the max-10 sub-agent cap
- **Name/Role:** the spawning employee.
- **What's Needed:** a hard ceiling of 10 concurrent sub-agents.
- **Problem:** unbounded fan-out makes orchestration un-auditable.
- **What Needs to Happen:** before spawning, count live `SA-#` rows; if ≥10, wait for one to finish.
- **Prompt for Employee Chat:** "Confirm <10 sub-agents live before spawning. WO-009 complete."

### WO-010 — One-and-done sub-agent logging
- **Name/Role:** the spawning employee.
- **What's Needed:** sub-agents that terminate and leave a clean audit trail.
- **Problem:** lingering sub-agents inflate the live count and blur ownership.
- **What Needs to Happen:** on finish, mark the `SA-#` done and clear its row; the number stays only
  in history for traceability.
- **Prompt for Employee Chat:** "Mark the sub-agent done, clear its row, keep the number logged.
  WO-010 complete."

WO-005 complete – deployment protocol drafted.

---

## Weekly Orchestration Health Check

A standing, lightweight sweep owned by the **MON department** (read-only observe → report;
MON-A01). Run it weekly to keep the ledger honest:

- **Count live `SA-#`** rows in the Active Sub-Agent Registry vs the Self-Deployment Log totals.
- **Clear finished rows** — move done sub-agents to the Completed Sub-Agent Results Log.
- **Verify ≤10** active sub-agents per employee (the hard cap holds for every roster row).
- **Flag stale WOs** — any `🟢 Open` / `🔨 Doing` Work Order with no movement gets surfaced.
- **Report, don't mutate** — MON files findings; the owning employee makes the fixes.

WO-015 complete.
