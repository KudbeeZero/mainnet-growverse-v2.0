"""
Coverage for db/seed.py seed_store branches + db/session.py rollback path.

Targets previously-uncovered branches:
- seed.py 78-79  : seed_strains() update path (existing row -> setattr)
- seed.py 134    : seed_store partner skipped when its strain isn't found
- seed.py 142-143: seed_store partner upsert update path (existing -> setattr)
- seed.py 205-206: seed_store() with session=None -> own session_scope()
- seed.py 211-214: main() wrapper (init_db + seed_strains + seed_store + print)
- seed.py 218    : `__main__` / sys.exit(main()) entry point
- session.py 45-58 / 66 : engine + sessionmaker construction branches
- session.py rollback-on-exception (commit/rollback/raise) path
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.db.session import (  # noqa: E402
    session_scope,
    reset_engine_for_tests,
    init_db,
)
from growpodempire.db.seed import seed_strains, seed_store, main  # noqa: E402
from growpodempire.db.models import (  # noqa: E402
    Player,
    Strain,
    StorePartner,
    FeaturedItem,
    Bundle,
)


class _BoomError(Exception):
    """Sentinel raised inside a session body to trigger the rollback path."""


# --------------------------------------------------------------------------- #
# session.py: rollback-on-exception (session_scope commit/rollback/raise)      #
# --------------------------------------------------------------------------- #
def test_session_scope_rolls_back_and_reraises_on_exception(db):
    """The body adds a Player then raises; the row must NOT persist and the
    original exception must propagate (session.py rollback + raise)."""
    with pytest.raises(_BoomError):
        with session_scope() as s:
            s.add(Player(username="rollback_victim"))
            s.flush()  # row is in the txn but not committed
            raise _BoomError("boom")

    # Fresh session: the rolled-back row must be gone.
    with session_scope() as s:
        found = (
            s.query(Player).filter(Player.username == "rollback_victim").one_or_none()
        )
        assert found is None


def test_session_scope_commits_on_success(db):
    """Happy path: body returns normally -> commit; row persists in a new scope."""
    with session_scope() as s:
        s.add(Player(username="committed_player"))

    with session_scope() as s:
        found = (
            s.query(Player).filter(Player.username == "committed_player").one_or_none()
        )
        assert found is not None


# --------------------------------------------------------------------------- #
# seed.py 78-79: seed_strains() update path on a re-run                        #
# --------------------------------------------------------------------------- #
def test_seed_strains_idempotent_updates_existing(db):
    """conftest's `db` fixture already ran seed_strains once, so every catalog
    slug exists. A second run takes the `existing is not None` -> setattr branch
    for every row and must not create duplicates."""
    with session_scope() as s:
        before = s.query(Strain).count()
        before_slugs = {x.slug for x in s.query(Strain.slug).all()}

    count = seed_strains()  # second run -> update branch (lines 78-79)
    assert count > 0

    with session_scope() as s:
        after = s.query(Strain).count()
        after_slugs = {x.slug for x in s.query(Strain.slug).all()}

    assert after == before  # idempotent: no new rows
    assert after_slugs == before_slugs


# --------------------------------------------------------------------------- #
# seed.py 205-206 + 138-139/142-143: seed_store via own session, then update   #
# --------------------------------------------------------------------------- #
def test_seed_store_session_none_then_idempotent_update(db):
    """First seed_store() call (session=None) opens its own session_scope
    (lines 205-206) and inserts partners/featured/bundles. A second call takes
    the partner update branch (142-143) and stays idempotent for all tables."""
    seed_store()  # session=None -> 205-206 own-scope, partners inserted

    with session_scope() as s:
        partners_1 = s.query(StorePartner).count()
        featured_1 = s.query(FeaturedItem).count()
        bundles_1 = s.query(Bundle).count()

    assert partners_1 > 0
    assert featured_1 > 0
    assert bundles_1 > 0

    seed_store()  # second run -> partner update path (142-143), no dupes

    with session_scope() as s:
        assert s.query(StorePartner).count() == partners_1
        assert s.query(FeaturedItem).count() == featured_1
        assert s.query(Bundle).count() == bundles_1


def test_seed_store_explicit_session_branch(db):
    """seed_store(session) with an explicit session runs the inline _run(session)
    branch (line 203) rather than opening its own scope."""
    with session_scope() as s:
        seed_store(s)
        s.flush()  # sessionmaker has autoflush=False; make pending rows queryable
        assert s.query(StorePartner).count() > 0


# --------------------------------------------------------------------------- #
# seed.py 134: partner skipped when its strain isn't found                     #
# --------------------------------------------------------------------------- #
def test_seed_store_skips_partners_when_no_strains(tmp_path):
    """On a schema-only DB with NO strains, every partner's product_id resolves
    to "" so each is skipped via `continue` (line 134); featured + bundles
    (which don't depend on strains) still seed."""
    db_path = tmp_path / "empty.db"
    reset_engine_for_tests(f"sqlite:///{db_path}")
    init_db()  # tables only, no strains seeded

    with session_scope() as s:
        assert s.query(Strain).count() == 0

    seed_store()

    with session_scope() as s:
        assert s.query(StorePartner).count() == 0  # all skipped -> line 134
        assert s.query(FeaturedItem).count() > 0
        assert s.query(Bundle).count() > 0


# --------------------------------------------------------------------------- #
# seed.py 211-214: main() wrapper                                             #
# --------------------------------------------------------------------------- #
def test_main_seeds_strains_and_store(tmp_path, capsys):
    """main() calls init_db + seed_strains + seed_store + print on a fresh DB."""
    db_path = tmp_path / "main.db"
    reset_engine_for_tests(f"sqlite:///{db_path}")

    main()  # lines 211-214

    out = capsys.readouterr().out
    assert "Seeded/updated" in out
    assert "strains + store data" in out

    with session_scope() as s:
        assert s.query(Strain).count() > 0
        assert s.query(StorePartner).count() > 0


# --------------------------------------------------------------------------- #
# seed.py 218: `__main__` entry point (sys.exit(main()))                       #
# --------------------------------------------------------------------------- #
def test_module_main_entrypoint(tmp_path):
    """Run the module as __main__ so the `if __name__ == '__main__'` guard and
    sys.exit(main()) (line 218) execute. main() returns None -> exit code 0."""
    import runpy

    db_path = tmp_path / "entry.db"
    reset_engine_for_tests(f"sqlite:///{db_path}")
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"

    with pytest.raises(SystemExit) as exc:
        runpy.run_module("growpodempire.db.seed", run_name="__main__")

    # sys.exit(None) -> code is None (treated as success / 0).
    assert exc.value.code in (None, 0)
