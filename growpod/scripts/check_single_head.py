#!/usr/bin/env python3
"""Fail if the Alembic migration graph has more than one head (a fork).

`make check-migrations` (and CI, before `alembic upgrade head`) runs this. Two
heads mean two migrations claim to be "latest" — `upgrade head` becomes
ambiguous and the schema forks. We catch that class of bug automatically instead
of discovering it when a deploy half-applies, and we print the exact
`alembic merge` command to resolve it.
"""
from __future__ import annotations

import sys
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory

REPO = Path(__file__).resolve().parent.parent


def main() -> int:
    cfg = Config(str(REPO / "alembic.ini"))
    # alembic.ini's script_location is repo-relative; anchor it.
    cfg.set_main_option("script_location", str(REPO / "alembic"))
    script = ScriptDirectory.from_config(cfg)
    heads = script.get_heads()

    if len(heads) <= 1:
        print(f"Alembic single-head OK — head: {heads[0] if heads else '(none)'}")
        return 0

    print("Alembic migration graph has MULTIPLE heads (a fork):")
    for h in heads:
        rev = script.get_revision(h)
        print(f"  - {h}  ({rev.doc if rev else '?'})")
    merge_args = " ".join(heads)
    print(
        "\nResolve with:\n"
        f"  alembic merge -m 'merge heads' {merge_args}\n"
        "then re-run this check."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
