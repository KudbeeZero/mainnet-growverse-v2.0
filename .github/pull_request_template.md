<!-- One PR = one purpose. Keep it small and short-lived: merge or close within ~a day. -->

## What & why
<!-- One clear purpose. What changes, and the problem it solves. -->

## Scope check
- [ ] Branch is based on the **latest `main`** (rebased/updated — not a stale base)
- [ ] **Not** stacked on another feature branch (base is `main`)
- [ ] One purpose only (no unrelated drive-by changes)

## Protected surfaces (tick only if touched — each needs the BUILD_RULES.md checks + owner OK)
- [ ] Economy / `balance.yaml`
- [ ] DB migration / Alembic
- [ ] Wallet / auth
- [ ] Deploy config (Fly / Render / Vercel / Dockerfile)
- [ ] Lockfile (`package-lock.json` / deps)
- [ ] None of the above

## Verification
<!-- Paste the commands you ran + results. -->
- [ ] `cd growpod && make test` (or targeted) — _result_
- [ ] `cd growpod/web && npm run typecheck && npm run build && npm run test` — _result_
- [ ] Playwright e2e (if UI) — _result_

## Closeout
**Asked:**
**Done:**
**Needs you:**

<!-- Reverting a merged feature? Record WHY in the revert commit/PR — never an empty "this reverts…". -->
