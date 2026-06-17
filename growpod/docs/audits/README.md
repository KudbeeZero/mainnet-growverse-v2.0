# Audits — one report per PR

Each PR that lands under the Session Relay Protocol gets **one** audit report here, written by
the independent auditor that `/handoff-audit` spawns. The auditor does **not** trust the PR's
prose: every claim is checked against the diff with `file:line` evidence, the suite is run, and
scope creep is flagged.

- **Filename:** `PR-<number>-<short-slug>.md` (e.g. `PR-8-atomic-purchase-core.md`).
- **Verdict:** every report ends in **PASS / CONCERNS / FAIL**.
  - **PASS** → safe to merge; start a new branch.
  - **CONCERNS** → ask the owner before merging; record what they decide.
  - **FAIL** → do not merge.
- **Template:** copy `TEMPLATE.md`.

See `docs/SESSION_PROTOCOL.md` for how audits fit the loop and the definition of done.
