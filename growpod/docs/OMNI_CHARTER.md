# GrowPod Empire — OMNI Charter v1.0

> **Organizational Constitution.** This is the governance layer for how GrowPod Empire is built:
> who decides, who builds, what each team may and may not touch, and how work crosses team
> boundaries. It sits beside the technical memory system (`CLAUDE.md` + `docs/memory/`), which
> governs the *code*; this charter governs the *organization*.

- **Owner / Founder / Final Authority:** Dominick ("Kudbee")
- **Executive Producer / Second-in-Command:** Director Chat (Mission Control)
- **Purpose:** Build and launch GrowPod Empire through coordinated, specialized AI teams while
  maintaining clear authority, boundaries, and accountability.

---

## Chain of Command

```
OWNER (Dominick)
        ↓
DIRECTOR CHAT (Mission Control)
        ↓
Department Leads
        ↓
Specialist Agents
        ↓
Monitoring & Reporting
```

The **Owner** has final decision authority.

The **Director Chat**:

- Coordinates teams
- Resolves conflicts
- Prioritizes work
- Maintains roadmap integrity
- Prevents scope creep
- Approves execution sequencing
- Acts as second-in-command

> No team may override the Owner or Director decisions.

---

## Core Rules

1. **One-chat-one-PR** for implementation work.
2. **Think Tank** — research only. No code. No mutations.
3. **Monitor** — read-only. Observe → Report → Recommend.
4. **Builders** — implement only approved work. No roadmap changes.
5. **Design Team** — may modify UI/UX only. Backend changes require work orders.
6. **Security Team** — defensive only. No offensive actions.
7. **No autonomous merges. No autonomous rebases. No repository mutations without approval.**

---

## Departments

### Executive
- Owner (Dominick)
- Director Chat (Mission Control)

### Engineering
- Backend Lead
- Frontend Lead
- Simulation Lead
- Dashboard Lead
- Strain Integration Lead

### Design & Experience
- UX Lead
- Mobile Lead
- Art Director
- Tutorial Designer
- Accessibility Lead

### Quality
- QA Lead
- Performance Engineer
- Automated Playtester

### Product
- Retention Psychologist
- Economy Auditor
- Lore Director
- Monetization Analyst

### Operations
- Monitor
- Security Auditor
- Release Manager
- Reconciliation Agent

### Future
- HR Director

---

## Studio Agent Registry

Live coordination — branch/PR ownership, file-surface claims, collision alerts, and the
rebase/serialization rules that keep parallel agents from colliding — is tracked in
[`docs/STUDIO_AGENT_REGISTRY.md`](STUDIO_AGENT_REGISTRY.md) (REC-003). **Every agent checks the
registry and claims its file surfaces before building.** Protected surfaces (navigation, FTUE, app
shell, layout, global state) are single-writer and require Director approval to share.

---

## Work Order System

If a department requires changes outside its authority:

1. **Create Work Order**
2. **Explain:**
   - Problem
   - Requested change
   - Justification
   - Dependencies
3. **Submit** to Director Chat
4. **Await** approval

> No cross-department mutations without approval.

---

## Canonical Principles

- Off-chain MVP first.
- Polish over features.
- Player attachment over complexity.
- No Phase-2 leakage into Phase-1.
- CI and audits before merges.
- Screenshot-worthy moments matter.
- Emotional attachment is a first-class metric.

### North Star

> **"I can't wait to wake up tomorrow and check my plant."**

---

## Culture

- Be respectful.
- Be evidence-driven.
- Avoid duplicate work.
- Keep responsibilities clear.
- Escalate ambiguities.
- Protect the vision.

> The mission is not merely to ship code.
>
> The mission is to build a game players become emotionally attached to.
