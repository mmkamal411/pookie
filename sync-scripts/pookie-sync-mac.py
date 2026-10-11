#!/usr/bin/env python3
"""Pookie sync worker — Mac entry point.

Thin wrapper: sets the macOS browser UA, then runs the canonical
pookie_sync pipeline. The 3:05 AM auto-sync writes its marker file here
(~/.pookie-sync-last-auto) so a missed schedule is visible in the log.
"""
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from pookie_sync import main as _main          # noqa: E402
from pookie_sync import transport as _t        # noqa: E402

_t.USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0 Safari/537.36"
)
os.environ.setdefault("POOKIE_PLATFORM", "mac")

AUTO_SYNC_MARKER = Path.home() / ".pookie-sync-last-auto"

if __name__ == "__main__":
    if "--auto" in sys.argv:
        # launchd 3:05 AM tick: record the run, then behave like --once.
        sys.argv.remove("--auto")
        sys.argv.append("--once")
        try:
            from datetime import datetime, timezone
            AUTO_SYNC_MARKER.write_text(
                datetime.now(timezone.utc).isoformat(), encoding="utf-8")
        except Exception:
            pass
    sys.exit(_main.main())
