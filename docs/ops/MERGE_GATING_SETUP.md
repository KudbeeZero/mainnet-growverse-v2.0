# Merge gating setup (owner, one-time)

These are the GitHub/Vercel settings that make merges safe and hands-free. They
can't be set from code (they're repo admin settings), so this is your click-list.
Do them once; they apply forever after.

## 1. Branch protection on `main` (required checks + up-to-date + auto-merge)

**UI path:** GitHub → repo **Settings → Rules → Rulesets → New branch ruleset**
(or **Settings → Branches → Add branch ruleset**).

Configure:
- **Name:** `main-protection`  · **Enforcement:** Active
- **Target branches:** Default branch (`main`)
- **Rules to enable:**
  - ✅ **Require status checks to pass** → add these two (exact names):
    - `backend (lint · memory · migrations · tests)`
    - `web (typecheck · lint · build · test · e2e)`
    - ✅ **Require branches to be up to date before merging** (this is the key one —
      it blocks stale-base merges like #22/#23).
  - ✅ **Require linear history** (we squash-merge).
  - ✅ **Block force pushes** · ✅ **Restrict deletions**.
  - **Require a pull request before merging:** ON, **Required approvals: 0**
    (solo dev — no human review gate; CI is the gate).

> The required-check names must match the CI **job** names in
> `.github/workflows/ci.yml` exactly. If you rename a job, update the ruleset.

**Then enable auto-merge:** **Settings → General → Pull Requests →**
✅ **Allow auto-merge**. After that, on each PR click **Enable auto-merge
(squash)** and it lands itself when green + up to date.

### Optional: import as a ruleset JSON
Settings → Rules → Rulesets → **⋯ → Import a ruleset**, with:

```json
{
  "name": "main-protection",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "required_linear_history" },
    { "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
      } },
    { "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "backend (lint · memory · migrations · tests)" },
          { "context": "web (typecheck · lint · build · test · e2e)" }
        ]
      } }
  ]
}
```
(`strict_required_status_checks_policy: true` == "require branches up to date".)

## 2. Deploy visibility env (so the build stamp shows the real commit)

Vercel auto-populates `VERCEL_GIT_COMMIT_SHA` and `VERCEL_ENV` on every build —
**nothing to set** for the web footer / `GET /version` to work.

Backend (Fly/Render) `/health` build stamp is optional — to populate it, set in
the host env:
- `GIT_SHA` = the deploy commit (Render auto-sets `RENDER_GIT_COMMIT`; Fly exposes `FLY_IMAGE_REF`)
- `APP_VERSION` = e.g. `2.0.4`

## 3. How to confirm a deploy shipped (the "did my update go live?" check)
- **Web:** hard-refresh `growverse.dev` → footer shows `v<version> · <sha>`; or
  `GET https://growverse.dev/version` → `{version, sha, builtAt, env}`. The `sha`
  changes on every deploy.
- **API:** `GET /health` → `{status, version, sha}`.

## What this prevents
- Stale-base / red-CI merges (#22/#23 class) — blocked by required checks + up-to-date.
- Manual merge babysitting — auto-merge lands green PRs itself.
- "I can't tell what's live" — the build stamp + `/version` always show the commit.
