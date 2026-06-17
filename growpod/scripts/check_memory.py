#!/usr/bin/env python3
"""Memory-layer integrity gate for GROWv2 (Layer 0-4 + the Design Codex).

`make check-memory` (and CI) runs this. It fails (exit 1) when the memory system
starts to *lie*:

  1. a **required** memory file is missing,
  2. a Design Codex doc has fallen **out of the layer map** (`MAP.md`),
  3. a **markdown link** points at a path that doesn't exist,
  4. a **✅ ("done") claim cites a path that doesn't exist** — the classic
     "claimed shipped, never built" drift.

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


def main() -> int:
    errors: list[str] = []

    # 1. required files exist
    for rel in REQUIRED:
        if not (REPO / rel).exists():
            errors.append(f"required memory file missing: {rel}")

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
