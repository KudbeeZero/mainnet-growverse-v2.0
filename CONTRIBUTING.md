# Contributing — merge discipline

This is the **lifecycle** companion to [`growpod/docs/BUILD_RULES.md`](growpod/docs/BUILD_RULES.md)
(the safety charter — *what* is safe to change) and
[`growpod/CLAUDE.md`](growpod/CLAUDE.md). It exists because we kept hitting the
same failures: work stranded in unmerged drafts, PRs merged on stale bases
without CI, stacked/obsolete PRs piling up, features reverted with no recorded
reason, and no way to tell what's actually deployed. These rules + the branch
protection in [`docs/ops/MERGE_GATING_SETUP.md`](docs/ops/MERGE_GATING_SETUP.md)
make that not happen again.

## Branch & PR rules
- **Base every branch on the latest `main`.** Update/rebase before merge — a
  stale base means CI may not reflect reality (and won't merge under the
  required "up to date" rule).
- **No stacked PRs.** Always base on `main`, never on another feature branch.
  If work depends on unmerged work, land the dependency first.
- **One PR = one purpose** (see BUILD_RULES.md §1). Branch name: `claude/<topic>`.
- **Short-lived.** Merge or close within ~a day. Don't let drafts linger — a
  draft that isn't being actively worked is noise; close it.
- **Close obsolete PRs promptly**, with a one-line reason.

## How a PR lands (auto-merge flow)
1. Open the PR (fill the template). CI runs automatically.
2. Click **Enable auto-merge (squash)**.
3. It merges itself the moment CI is **green** and the branch is **up to date** —
   no babysitting. If CI is red or the branch is behind, it will not merge.
- Merges are **squash** only (linear history).
- `main` → production deploy (Vercel `growverse.dev`). Confirm the live build via
  the footer build stamp / `GET /version` (commit SHA changes on every deploy).

## Reverts
- **Never** merge an empty "This reverts commit …". Every revert records **why**
  (what broke, link to evidence) in the commit body or PR. (We lost track of why
  onboarding/demo were reverted — don't repeat that.)

## Protected surfaces (stop + owner OK)
`balance.yaml` / economy, DB migrations, wallet/auth, deploy config, lockfiles —
see BUILD_RULES.md. The PR template has the checklist; CODEOWNERS flags them.
