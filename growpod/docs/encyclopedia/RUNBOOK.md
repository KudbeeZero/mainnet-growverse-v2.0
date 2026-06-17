# Encyclopedia research loop — RUNBOOK

Standing procedure for ONE batch iteration. Each scheduled wake-up (~30 min) runs
one batch. **Touch no game code** — only files under `docs/encyclopedia/`. No push.

## Per-batch steps
1. Read `docs/encyclopedia/_ledger.json`.
   - **STOP** if `queue` is empty OR `meta.loop.iterations_done >= meta.loop.iterations_planned`.
     On stop: append a final summary line to `_PROGRESS.md`, do NOT schedule another
     wakeup, print a closing summary.
2. Take the next up-to-`batch_target` (12) names from `queue`.
3. Launch the saved research workflow:
   `Workflow({scriptPath: "/home/dziostar/.claude/projects/-home-dziostar-projects-Grovers/5dd91dde-c6c1-498a-9110-b91e5a971f69/workflows/scripts/strain-research-batch-wf_1df4e72e-f1f.js", args: <12 names as JSON array>})`
   Turn ends; the workflow runs in the background and notifies on completion.
4. On the completion notification, read its output file (`<result>` wrapper),
   take `result.entries`, dump to `docs/encyclopedia/_batch_NN.json`, then run:
   `.venv/bin/python docs/encyclopedia/_render.py docs/encyclopedia/_batch_NN.json "Batch NN"`
   (render is idempotent: skips slugs that already have a file; updates INDEX +
   ledger + progress.)
5. Validate new files: each `strains/*.md` frontmatter must `yaml.safe_load` and its
   `game_mapping` must satisfy `SCHEMA.md` bounds (and lineage_type ∈ {landrace, hybrid}
   — NOT bred). Note any failures in `_PROGRESS.md`.
6. `ScheduleWakeup(delaySeconds=1800, prompt=<standing loop prompt>)` to do the next
   batch in ~30 min. Then end the turn.

## CRITICAL lessons from this session (do not relearn the hard way)
- **Write files with Python (`open(...).write(...)`), NOT the Write tool.** The Write
  tool appended a literal `</content>` line to every file it created this session,
  which corrupted JSON/YAML. The renderer and these heredocs use plain file I/O.
- **`args` arrives as a STRING**, not a JSON array. The workflow script parses it
  (`parseNames`) — do not "fix" that back to expecting an array.
- **YAML `#` trap:** ` #` (e.g. "Gelato #42") starts a comment and breaks flow
  sequences. The renderer serializes via `yaml.safe_dump` so quoting is automatic —
  keep it; never hand-build the frontmatter.
- **lineage_type:** the live catalog uses only `landrace` / `hybrid`. `bred` is
  reserved for player-bred crosses — never emit it for real-world strains.

## Key paths
- Workflow script: `/home/dziostar/.claude/projects/-home-dziostar-projects-Grovers/5dd91dde-c6c1-498a-9110-b91e5a971f69/workflows/scripts/strain-research-batch-wf_1df4e72e-f1f.js`
- Renderer (durable, co-located): `docs/encyclopedia/_render.py`
  (a `/tmp/render_strains.py` copy may also exist but is NOT relied upon)
- State of truth: `_ledger.json` (`done` slugs, remaining `queue`, loop counters)
- Per-batch raw data: `_batch_NN.json` (durable; re-renderable any time)
