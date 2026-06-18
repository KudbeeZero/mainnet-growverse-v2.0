# Global Build Rules — Safety Charter (GROWv2)

> **Build safely, not just quickly.** This is the standing safety rulebook for every change
> made to this repository. It sits beside the memory system (`CLAUDE.md` + `docs/memory/`,
> which govern the *code*) and the [Session Relay Protocol](SESSION_PROTOCOL.md) (which governs
> the *handoff between chats*). Where this file and the relay protocol overlap, they agree by
> design — this file is the "what is safe to change and how do I prove it" layer.
>
> The layer *above* this one — reconcile memory ↔ evidence ↔ confidence and label every
> finding before recommending — is the [Global Evidence + Memory Layer](GLOBAL_EVIDENCE_MEMORY_LAYER.md).
> That decides *what's true and what to do*; this decides *what is safe to change and how to prove it*.

## Prime directive

```
Before writing code, audit.
Before expanding scope, ask.
Before merging, prove.
Before building new features, protect the foundation.
```

No feature is worth destabilizing the repo. The goal is to prevent scope creep, broken local
environments, duplicate migrations, hidden economy logic, unreviewed feature work, and PRs that
grow too large to understand.

---

## 1. One PR = one purpose

Every PR has exactly **one** clear purpose. Allowed PR types:

- Infrastructure stabilization
- Bug fix
- Test backfill
- Feature implementation
- Economy readiness
- UI polish
- Documentation / runbook update

Do **not** mix these unless explicitly authorized. In particular:

- Do not combine Alembic migration fixes with gameplay features.
- Do not combine economy activation with coverage backfill.
- Do not combine UI polish with API changes.
- Do not combine feature flags with new game mechanics.
- Do not fix unrelated nearby issues unless they directly block the assigned task.

If unrelated issues are discovered, record them under **Follow-up Work** (§10) and stop.

> This is the same rule as OMNI Charter "One-chat-one-PR" and the relay protocol's
> "One chat = one PR" — stated here as a scope contract for the *change itself*.

---

## 2. Audit before action

Before changing files, perform a **read-only** audit that identifies:

- Relevant files and current behavior
- Existing tests and existing scripts/checks
- Risk areas, and whether similar code already exists
- Whether the task touches **database, economy, wallet, auth, migrations, or feature flags**

Do not assume. Verify. If the task touches a risky area, **call it out before coding**.

**Risky areas** (require an explicit risk note up front):

- Database migrations · Alembic heads / schema changes
- Economy values — rewards, claims, upgrades, costs, token flows
- Wallet or Algorand logic
- Feature flags
- Authentication / permissions
- Worker infrastructure · build tooling · lockfiles (`pnpm-lock.yaml`, `uv.lock`)
- Environment variables · local runbooks

---

## 3. Protect the local dev loop

Every PR that affects running the app must **preserve or improve** the local dev loop.

When relevant, verify and document:

- Backend start command — `make serve` (runs `server.py`)
- Frontend start command — `cd web && npm i && npm run dev`
- Frontend can talk to backend (proxy mode preferred where useful)
- Port assumptions removed or documented
- Runbook (`CLAUDE.md` "Run it", `replit.md`) updated if commands changed

If a check has no CI, the manual verification must be written into the PR handoff.
**Do not say "green" unless the command actually ran.**

---

## 4. Migration rules

Database migrations are **protected**. Before creating or editing a migration:

- Check current Alembic heads and migration history
- Confirm whether a fork already exists and whether a merge migration is needed
- Run the upgrade locally if possible

Required checks (this repo):

```bash
alembic heads                 # inspect heads
alembic upgrade head          # apply locally
make check-migrations         # scripts/check_single_head.py — fails on >1 head
```

**Never leave two Alembic heads** unless the task explicitly creates a controlled merge
migration. **No feature work** may be mixed into a migration-repair PR.

---

## 5. Economy rules

The economy is a **protected system**. Anything affecting rewards, claims, production, payouts,
upgrade costs, timers, burns, fees, bonuses, token amounts, land output, battle rewards, worker
output, or progression unlocks must be **config-driven and tested**.

- Economy values live in the canonical config: **`src/growpodempire/data/balance.yaml`**.
- Do **not** hardcode economy numbers in UI components, service files, API handlers, or tests
  — unless the test is explicitly asserting a config-loaded value.
- Money is `Decimal`, ledger-based, auditable. **Every faucet must have a matching sink.**

Before flipping **any** economy feature live, run an **Economy Readiness Audit**:

1. Map sources and sinks.
2. Identify exploit paths.
3. Add simulation tests.
4. Add claim/reward **duplicate-prevention** tests.
5. Verify ON **and** OFF behavior.
6. Verify direct API bypasses are blocked.
7. Verify negative or repeated reward paths are impossible.

**Do not flip economy live in a mixed PR.** (See §13 — economy activation is a stop condition.)

---

## 6. Feature flag rules

Feature flags are **real controls, not labels**. For every flag touched, verify:

- OFF behavior · ON behavior · default behavior
- Tests cover the intended behavior
- The app does not silently ignore the flag

If `FEATURES` are temporarily forced ON for playtest/dev, **document it clearly**. Forced-ON is
**not** production-ready. A feature is not live-ready until the *config-controlled* path is tested.

---

## 7. Testing rules

Before handoff, run the smallest meaningful test set and document **exact** results. Use the
repo's existing commands (inspect `Makefile`, `pyproject.toml`, `package.json`, README/runbooks
first). When relevant:

```bash
make test                                  # pytest + coverage gate
make lint                                  # E9,F63,F7,F82 ruff gate (matches CI)
make check-memory                          # memory-layer integrity
make check-migrations                      # single Alembic head
cd web && npm run typecheck && npm run lint && npm run build
cd web && npm run test          # vitest          (and test:e2e if the loop UI changed)
```

Report exact numbers, e.g. `Python: 319 passed, 6 skipped, 0 failed` · `Web vitest: 218 passed`.
**Never hide non-green results.** If a failing check is pre-existing, prove it by explaining why
this PR did not introduce or expand the failing area.

---

## 8. Coverage rules

Coverage backfill gets **its own PR** unless directly required by the assigned task. Do not sneak
coverage backfill into feature PRs. If coverage is below floor due to prior debt:

- Document it (with exact % and the floor).
- Do **not** expand the current PR.
- Recommend a separate focused test-backfill PR.
- Name the modules dragging coverage down.

---

## 9. Handoff rules

Every PR handoff includes: **Asked · Done · Files-changed summary · Tests/checks run · Exact
results · Risks · What was intentionally not done · Follow-up work · Audit-ready or draft ·
Whether CI exists · Whether manual verification is needed.**

Status labels: `DRAFT` · `AWAITING_AUDIT` · `NEEDS_FIXES` · `READY_TO_MERGE` · `HOLD`.

**Do not mark `READY_TO_MERGE` without an audit** (`/handoff-audit` PASS — see SESSION_PROTOCOL).

---

## 10. No silent scope expansion

If you discover something important but out of scope, **stop and report it** in this form:

```
Found but not changed:
1. Issue:
2. Risk:
3. Recommended follow-up PR:
4. Blocking current task? Yes/No.
```

Only continue if it **blocks** the assigned task.

---

## 11. Sub-agent rule

Use up to **10 sub-agents** deliberately when the task is broad or risky. Recommended roles:
Repo Mapper · Test Runner · Backend Auditor · Frontend Auditor · Migration Auditor · Economy
Auditor · Feature Flag Auditor · Security/Exploit Auditor · Runbook/Docs Agent · Handoff Agent.
Each sub-agent has a **focused** job and reports findings **before** implementation begins.

---

## 12. Build order rule

```
1. Stabilize local run
2. Fix migrations / schema foundation
3. Confirm backend ↔ frontend communication
4. Lock feature-flag / config behavior
5. Audit economy
6. Add simulation and exploit tests
7. Build gameplay features
8. Polish UI
9. Merge only after audit
```

Do not build big gameplay systems on unstable infrastructure.

---

## 13. Stop conditions

**Stop immediately and ask for direction** if:

- More than one migration head appears
- The local app cannot run
- Tests fail in unrelated areas
- The task requires economy activation
- The task requires wallet/token changes
- The task requires changing feature-flag semantics
- Coverage fails and the fix would be broad
- The PR is becoming larger than the original assignment
- You find duplicate systems doing the same job
- You are unsure whether a change is gameplay, infrastructure, or economy

**Stopping is better than guessing.**

---

## 14. Default response style

Report back direct and structured:

```
Asked:
Done:
Verified:
Not Done:
Risks:
Next:
```

Do not overstate success. Do not say "ready" unless it is truly ready. Do not say "green"
unless the checks ran and passed. Do not bury warnings. Do not keep coding after handoff
unless explicitly authorized.

---

## 15. Current operating rule

**No new major gameplay work begins until all of the following are true:**

1. Local dev loop is stable
2. Migration state is clean (single head)
3. Economy readiness audit is complete
4. Economy sources/sinks are mapped
5. Simulation tests are planned or implemented
6. The current PR is frozen, audited, or merged

If any are not true, recommend the **safest next stabilization PR** instead of building a new
feature.
