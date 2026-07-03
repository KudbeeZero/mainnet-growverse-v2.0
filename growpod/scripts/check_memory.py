#!/usr/bin/env python3
"""Memory-layer integrity gate for GROWv2 (Layer 0-4 + the Design Codex).

`make check-memory` (and CI) runs this. It fails (exit 1) when the memory system
starts to *lie*:

  1. a **required** memory file is missing,
  2. a Design Codex doc has fallen **out of the layer map** (`MAP.md`),
  3. a **markdown link** points at a path that doesn't exist,
  4. a **✅ ("done") claim cites a path that doesn't exist** — the classic
     "claimed shipped, never built" drift,
  5. the **backlog goes stale while code ships** — BACKLOG.md's
     `Last reconciled: **YYYY-MM-DD**` marker must be within
     BACKLOG_MAX_STALE_DAYS of the HEAD commit date. Quiet repos never fail
     (HEAD ages with the backlog); active repos must tick the backlog.
     (Owner directive 2026-07-02: the backlog is part of the workflow —
     it went unreconciled for 3 weeks of merged PRs once; never again.)
  6. an **unresolved git merge-conflict marker** was committed into a memory
     doc (`<<<<<<<`, a bare `=======` divider, or `>>>>>>>`). BACKLOG.md once
     shipped all three from a two-branch merge and no gate caught it — the log
     is append-mostly, so a collision resolves by keeping both sides' entries,
     not by leaving the markers in. Never again.

Paths in the memory docs are repo-relative by convention, but may be written
relative to the code root (`src/growpodempire/`) or the memory root
(`docs/memory/`) — MAP.md says as much. We resolve a cited path against that
small set of roots and only flag it when it resolves under *none*. Tokens that
aren't concrete file paths (API routes like `/state`, branch names like
`origin/main`, globs, `<placeholders>`) are deliberately ignored, so the gate
stays honest without crying wolf.

Stdlib only; no third-party imports.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# Roots a cited path may be written relative to.
ROOTS = [REPO, REPO / "src" / "growpodempire", REPO / "docs" / "memory"]

# Files every session relies on. Missing one means the memory system is broken.
REQUIRED = [
    "CLAUDE.md",
    "docs/memory/MAP.md",
    "docs/memory/README.md",
    "docs/memory/ARCHITECTURE.md",
    "docs/memory/DECISIONS.md",
    "docs/memory/BACKLOG.md",
    "docs/memory/design/README.md",
]

KNOWN_EXT = {
    ".py", ".yaml", ".yml", ".md", ".ini", ".toml", ".sh",
    ".ts", ".tsx", ".json", ".jpeg", ".jpg", ".png",
}

DONE = "✅"  # ✅
LINK_RE = re.compile(r"\]\(([^)]+)\)")
TOKEN_RE = re.compile(r"`([^`]+)`")
# Git conflict markers, matched precisely so prose never trips them: the
# openers/closers carry git's exact 7-char run + a trailing space, and the
# divider is a line of *exactly* seven '=' (a setext-style rule would differ).
CONFLICT_RE = re.compile(r"^(<{7} |={7}$|>{7} )")


def _is_path_like(tok: str) -> bool:
    """True if a backticked token looks like a concrete repo file/dir path."""
    if not tok or any(c in tok for c in " *<>") or "://" in tok:
        return False
    if tok.startswith(("http", "mailto:", "#")):
        return False
    if tok.endswith("/"):
        return True  # explicit directory
    # strip a trailing :anchor (e.g. engine.py:_rng_for) before judging
    base = tok.split(":", 1)[0]
    return Path(base).suffix.lower() in KNOWN_EXT


def _resolve(tok: str) -> bool:
    """True if a path-like token exists under any known root."""
    tok = tok.split(":", 1)[0]  # drop :anchor
    is_dir = tok.endswith("/")
    rel = tok.rstrip("/")
    for root in ROOTS:
        p = root / rel
        if p.exists() and (p.is_dir() if is_dir else True):
            return True
    # bare filename (no slash): allow a recursive match under code/docs roots
    if "/" not in rel and not is_dir:
        for root in (REPO / "src", REPO / "docs"):
            if root.exists() and next(root.rglob(rel), None) is not None:
                return True
    return False


BACKLOG_MAX_STALE_DAYS = 14
RECONCILED_RE = re.compile(r"Last reconciled: \*\*(\d{4}-\d{2}-\d{2})\*\*")


def _backlog_staleness_error() -> str | None:
    """Return an error string when BACKLOG.md's reconcile marker has fallen
    more than BACKLOG_MAX_STALE_DAYS behind the HEAD commit date, else None.

    Uses the HEAD commit date (not wall clock) so an untouched repo never
    rots into a failure; only shipping code without ticking the backlog does.
    Skips silently when git is unavailable (e.g. a source tarball).
    """
    import subprocess
    from datetime import date

    text = (REPO / "docs/memory/BACKLOG.md").read_text(encoding="utf-8")
    m = RECONCILED_RE.search(text)
    if not m:
        return (
            "BACKLOG.md is missing its 'Last reconciled: **YYYY-MM-DD**' marker "
            "— the backlog-freshness gate needs it (see MAP.md maintenance)."
        )
    try:
        head = subprocess.run(
            ["git", "log", "-1", "--format=%cs"],
            cwd=REPO, capture_output=True, text=True, timeout=10,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if head.returncode != 0 or not head.stdout.strip():
        return None
    head_date = date.fromisoformat(head.stdout.strip())
    reconciled = date.fromisoformat(m.group(1))
    stale = (head_date - reconciled).days
    if stale > BACKLOG_MAX_STALE_DAYS:
        return (
            f"BACKLOG.md is stale: last reconciled {reconciled} but code shipped "
            f"as recently as {head_date} ({stale}d > {BACKLOG_MAX_STALE_DAYS}d). "
            "Reconcile the backlog (tick done/doing, add new work, bump the "
            "'Last reconciled' date) — it is part of every session's closeout."
        )
    return None


def main() -> int:
    errors: list[str] = []

    # 1. required files exist
    for rel in REQUIRED:
        if not (REPO / rel).exists():
            errors.append(f"required memory file missing: {rel}")

    # 5. the backlog keeps up with shipped code
    if (REPO / "docs/memory/BACKLOG.md").exists():
        stale = _backlog_staleness_error()
        if stale:
            errors.append(stale)

    # 2. every Design Codex doc is referenced in the layer map
    map_text = (REPO / "docs/memory/MAP.md").read_text(encoding="utf-8")
    design_dir = REPO / "docs/memory/design"
    if design_dir.exists():
        for doc in sorted(design_dir.glob("*.md")):
            if doc.name == "README.md":
                continue
            if doc.name not in map_text:
                errors.append(
                    f"codex doc out of the layer map (not named in MAP.md): "
                    f"design/{doc.name}"
                )

    # 3 + 4. scan every markdown memory file for broken links / ✅ citations
    md_files = [REPO / "CLAUDE.md", *sorted((REPO / "docs/memory").rglob("*.md"))]
    for md in md_files:
        if not md.exists():
            continue
        rel = md.relative_to(REPO)
        for n, line in enumerate(md.read_text(encoding="utf-8").splitlines(), 1):
            # 6. no unresolved git merge-conflict marker survived a commit
            if CONFLICT_RE.match(line):
                errors.append(
                    f"{rel}:{n}: unresolved git conflict marker -> {line[:12]!r} "
                    "(resolve the merge; keep both sides' entries in this "
                    "append-mostly log, don't leave the markers)"
                )
            # 3. markdown links resolve (relative to the file's own dir)
            for target in LINK_RE.findall(line):
                t = target.split("#", 1)[0].strip()
                if not t or t.startswith(("http", "mailto:", "/")):
                    continue
                if not (md.parent / t).exists():
                    errors.append(f"{rel}:{n}: broken link -> {target}")
            # 4. a ✅ line must not cite a path that doesn't exist
            if DONE in line:
                for tok in TOKEN_RE.findall(line):
                    if _is_path_like(tok) and not _resolve(tok):
                        errors.append(
                            f"{rel}:{n}: ✅ claim cites a missing path -> `{tok}`"
                        )

    if errors:
        print("Memory integrity check FAILED:\n")
        for e in errors:
            print(f"  - {e}")
        print(f"\n{len(errors)} problem(s). Fix the docs or build what they claim.")
        return 1

    print(f"Memory integrity OK — {len(md_files)} files, links + ✅ citations resolve.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
