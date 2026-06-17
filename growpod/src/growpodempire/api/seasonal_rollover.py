"""
Background thread that automatically rolls over auto_renew seasonal strains
at the start of each calendar month.

Lifecycle
---------
Call ``start_rollover_thread()`` once during app startup (after the DB is
initialised).  The thread:

1. Runs ``SeasonalService.rollover_renewals()`` immediately on first tick —
   catches any month boundary that was missed if the service was down.
2. Sleeps until 00:05 UTC on the 1st of the next month (the 5-minute offset
   gives the DB a moment to settle after any deploy-time migration).
3. Repeats indefinitely.

The rollover is fully idempotent: if a next-month entry already exists the
method skips it, so running it multiple times (e.g. from the manual endpoint
AND the thread) is safe.
"""

import logging
import threading
import time
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

_thread: threading.Thread | None = None


def _seconds_until_next_month() -> float:
    """Return seconds until 00:05 UTC on the 1st of next month."""
    now = datetime.now(timezone.utc)
    year, month = now.year, now.month
    if month == 12:
        year, month = year + 1, 1
    else:
        month += 1
    target = datetime(year, month, 1, 0, 5, 0, tzinfo=timezone.utc)
    return max(0.0, (target - now).total_seconds())


def _rollover_loop() -> None:
    """Worker: run rollover now, then once per month at month boundary."""
    while True:
        try:
            from ..db.session import session_scope
            from ..services.seasonal_service import SeasonalService

            with session_scope() as s:
                created = SeasonalService(s).rollover_renewals()

            if created:
                logger.info(
                    "seasonal_rollover: auto-rolled %d strain(s) into next month: %s",
                    len(created),
                    [r["strain_name"] for r in created],
                )
            else:
                logger.debug("seasonal_rollover: no auto-renew strains due this tick")

        except Exception:
            logger.exception("seasonal_rollover: error during rollover — will retry next month")

        sleep_secs = _seconds_until_next_month()
        logger.info("seasonal_rollover: sleeping %.0f s until next month boundary", sleep_secs)
        time.sleep(sleep_secs)


def start_rollover_thread() -> None:
    """Spawn the monthly rollover thread (idempotent — safe to call multiple times)."""
    global _thread
    if _thread is not None and _thread.is_alive():
        return
    _thread = threading.Thread(
        target=_rollover_loop,
        name="seasonal-rollover",
        daemon=True,
    )
    _thread.start()
    logger.info("seasonal_rollover: background thread started")
