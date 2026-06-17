#!/usr/bin/env bash
# SessionStart hook for GROWv2 / Claude Code on the web.
#
# Two jobs:
#   1. Best-effort install deps so "can you run the tests?" is always yes. Uses the venv
#      flow (`make setup`) to sidestep the distro-managed-PyYAML collision that breaks a
#      bare `pip install` on some boxes. PYTHONPATH=src is set in .claude/settings.json
#      (env block), mirroring CI.
#   2. Print the baton (docs/HANDOFF.md) so every session starts informed — the single
#      source of truth for what to do first (see docs/SESSION_PROTOCOL.md).
#
# Never fatal: dependency install is best-effort; a session must still start if the network
# or pip is unavailable. We always exit 0.
set -u

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root" || exit 0

# --- 1. deps (best-effort, only if the venv is missing) ---------------------------------
if [ ! -d ".venv" ]; then
  echo "[session-start] no .venv — installing deps via 'make setup' (best-effort)…" >&2
  make setup >/tmp/growv2-session-setup.log 2>&1 \
    && echo "[session-start] deps installed." >&2 \
    || echo "[session-start] 'make setup' did not complete; see /tmp/growv2-session-setup.log" >&2
else
  echo "[session-start] .venv present — skipping install." >&2
fi

# --- 2. print the baton ------------------------------------------------------------------
echo "================= GROWv2 BATON (docs/HANDOFF.md) ================="
if [ -f docs/HANDOFF.md ]; then
  cat docs/HANDOFF.md
else
  echo "(!) docs/HANDOFF.md missing — start with /handoff-audit and rebuild the baton."
fi
echo "================================================================="
echo "Protocol: start with /handoff-audit, end with /closeout. One chat = one PR."

exit 0
