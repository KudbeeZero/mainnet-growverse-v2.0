"""
Daily game-state snapshot.

Captures a point-in-time backup of the authoritative game state plus the active
balance/strain lookup tables, so the game can be rolled back or audited:

  * the database (pg_dump for Postgres; file copy for SQLite),
  * the active balance.yaml and strains.yaml,
  * a manifest.json (timestamp, git SHA, per-table row counts, file checksums).

Everything is written to ``snapshots/<YYYY-MM-DD>/`` and bundled into a single
``snapshots/<YYYY-MM-DD>.tar.gz``. Re-running on the same day overwrites that
day's snapshot (idempotent). Old snapshots can be pruned with
``--retention-days``.

Usage:
    python -m growpodempire.scripts.snapshot [--out DIR] [--retention-days N]

Designed to run unattended from a scheduler (see .github/workflows/snapshot.yml).
It reuses the app's configured DATABASE_URL and data-file paths, so it snapshots
exactly what the running app uses.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tarfile
from pathlib import Path

from sqlalchemy import text

from ..config import get_settings
from ..db.session import get_engine

# Tables we report row counts for in the manifest (audit / drift detection).
KEY_TABLES = [
    "players",
    "wallets",
    "ledger_entries",
    "strains",
    "seed_inventory",
    "grow_pods",
    "plants",
    "harvests",
    "breeding_events",
    "contracts",
    "market_listings",
]


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _git_sha() -> str:
    try:
        out = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            check=True,
        )
        return out.stdout.strip()
    except Exception:
        return os.environ.get("GIT_SHA", "unknown")


def _dump_database(database_url: str, dest_dir: Path) -> str:
    """Dump the database into dest_dir; return the created file's name."""
    if database_url.startswith("sqlite"):
        # sqlite:///path/to.db  ->  path/to.db  (in-memory DBs can't be copied).
        src = database_url.split("sqlite:///", 1)[-1]
        if not src or src == ":memory:":
            raise SystemExit("Cannot snapshot an in-memory SQLite database")
        out = dest_dir / "database.sqlite"
        shutil.copyfile(src, out)
        return out.name

    if database_url.startswith("postgresql"):
        out = dest_dir / "database.dump"
        # Custom format (-Fc) is compressed and restorable with pg_restore.
        subprocess.run(
            ["pg_dump", "--no-owner", "--no-privileges", "-Fc", "-f", str(out), database_url],
            check=True,
        )
        return out.name

    raise SystemExit(f"Unsupported database scheme for snapshot: {database_url}")


def _row_counts() -> dict[str, int | str]:
    counts: dict[str, int | str] = {}
    engine = get_engine()
    with engine.connect() as conn:
        for table in KEY_TABLES:
            try:
                counts[table] = conn.execute(
                    text(f"SELECT COUNT(*) FROM {table}")
                ).scalar_one()
            except Exception as exc:  # table may not exist on older schemas
                counts[table] = f"unavailable ({type(exc).__name__})"
    return counts


def _copy_config(settings, dest_dir: Path) -> list[str]:
    copied: list[str] = []
    for label, src in (
        ("balance.yaml", settings.balance_file),
        ("strains.yaml", settings.strains_file),
    ):
        src_path = Path(src)
        if src_path.exists():
            shutil.copyfile(src_path, dest_dir / label)
            copied.append(label)
    return copied


def _prune(out_root: Path, retention_days: int) -> list[str]:
    if retention_days <= 0:
        return []
    cutoff = dt.date.today() - dt.timedelta(days=retention_days)
    removed: list[str] = []
    for entry in out_root.iterdir():
        # Match "YYYY-MM-DD" dirs and "YYYY-MM-DD.tar.gz" archives.
        stem = entry.name[:-7] if entry.name.endswith(".tar.gz") else entry.name
        try:
            day = dt.date.fromisoformat(stem)
        except ValueError:
            continue
        if day < cutoff:
            if entry.is_dir():
                shutil.rmtree(entry)
            else:
                entry.unlink()
            removed.append(entry.name)
    return removed


def create_snapshot(out_root: Path, retention_days: int = 30) -> Path:
    settings = get_settings()
    out_root.mkdir(parents=True, exist_ok=True)

    today = dt.date.today().isoformat()
    day_dir = out_root / today
    if day_dir.exists():  # idempotent: replace today's snapshot
        shutil.rmtree(day_dir)
    day_dir.mkdir(parents=True)

    db_file = _dump_database(settings.database_url, day_dir)
    config_files = _copy_config(settings, day_dir)

    manifest = {
        "created_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "git_sha": _git_sha(),
        "database_scheme": settings.database_url.split(":", 1)[0],
        "database_file": db_file,
        "config_files": config_files,
        "row_counts": _row_counts(),
        "checksums": {
            p.name: _sha256(p) for p in sorted(day_dir.iterdir()) if p.is_file()
        },
    }
    (day_dir / "manifest.json").write_text(json.dumps(manifest, indent=2, default=str))

    archive = out_root / f"{today}.tar.gz"
    if archive.exists():
        archive.unlink()
    with tarfile.open(archive, "w:gz") as tar:
        tar.add(day_dir, arcname=today)

    removed = _prune(out_root, retention_days)

    print(f"Snapshot written: {archive}")
    print(f"  files: {', '.join(sorted(manifest['checksums']))}")
    print(f"  row counts: {manifest['row_counts']}")
    if removed:
        print(f"  pruned (> {retention_days}d): {', '.join(sorted(removed))}")
    return archive


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Create a daily game-state snapshot")
    parser.add_argument(
        "--out",
        default=os.environ.get("SNAPSHOT_DIR", "snapshots"),
        help="Output directory for snapshots (default: ./snapshots)",
    )
    parser.add_argument(
        "--retention-days",
        type=int,
        default=int(os.environ.get("SNAPSHOT_RETENTION_DAYS", "30")),
        help="Delete snapshots older than N days (0 disables pruning)",
    )
    args = parser.parse_args(argv)
    create_snapshot(Path(args.out), retention_days=args.retention_days)
    return 0


if __name__ == "__main__":
    sys.exit(main())
