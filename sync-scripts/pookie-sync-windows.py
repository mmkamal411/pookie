#!/usr/bin/env python3
"""Pookie sync worker — Windows entry point.

Thin wrapper: sets the Windows browser UA, then runs the canonical
pookie_sync pipeline. Install next to sync-config.json (e.g. C:\\pookie-sync\\).
"""
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from pookie_sync import main as _main          # noqa: E402
from pookie_sync import transport as _t        # noqa: E402

_t.USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0 Safari/537.36"
)
os.environ.setdefault("POOKIE_PLATFORM", "windows")

if __name__ == "__main__":
    sys.exit(_main.main())
