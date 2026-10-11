"""Entry point for the Pookie school-portal sync worker.

Usage:
  python3 -m pookie_sync.main --once            # claim one job, exit
  python3 -m pookie_sync.main --sync-now        # force a full sync (bypass queue)
  python3 -m pookie_sync.main --store-password # save the school password to the OS keychain
  python3 -m pookie_sync.main --request-sync   # insert a SYNC NOW job for this child

Retries failed syncs with exponential backoff (config: max_retries,
retry_base_delay, retry_max_delay).
"""

import argparse
import getpass
import sys
import time
import traceback
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from pookie_sync import credentials  # noqa: E402
from pookie_sync.adapters import cobb  # noqa: E402
from pookie_sync.config import cfg_get, load_config  # noqa: E402
from pookie_sync.pipeline import do_sync  # noqa: E402
from pookie_sync.queue import heartbeat, request_job  # noqa: E402
from pookie_sync.supabase import SupabaseClient  # noqa: E402


def run_with_retries(cfg, sb, child, password):
    max_retries = cfg["max_retries"]
    base_delay = cfg["retry_base_delay"]
    max_delay = cfg["retry_max_delay"]
    attempt, delay = 0, base_delay
    while attempt < max_retries:
        attempt += 1
        cobb.log(f"Sync attempt {attempt}/{max_retries}")
        try:
            result = do_sync(cfg, sb, child, password)
            if result is None:
                cobb.log("No work to do, not retrying.")
                return True
            cobb.log("Sync succeeded.")
            return True
        except Exception as e:
            cobb.log(f"Attempt {attempt} failed: {e}", "err")
            cobb.log(traceback.format_exc(), "err")
            if attempt < max_retries:
                cobb.log(f"Retrying in {delay}s…")
                time.sleep(delay)
                delay = min(delay * 2, max_delay)
    cobb.log("Max retries reached.", "err")
    return False


def main(argv=None):
    ap = argparse.ArgumentParser(description="Pookie school-portal sync worker")
    ap.add_argument("--once", action="store_true", help="Claim one job and exit")
    ap.add_argument("--sync-now", action="store_true", help="Force a full sync (bypass queue)")
    ap.add_argument("--request-sync", action="store_true", help="Insert a SYNC NOW job for this child")
    ap.add_argument("--store-password", action="store_true",
                    help="Save the school password to the OS keychain, then exit")
    ap.add_argument("--config", default=None, help="Path to sync-config.json")
    ap.add_argument("--log-dir", default=None, help="Directory for sync.log and debug files")
    args = ap.parse_args(argv)

    config_path = Path(args.config) if args.config else HERE / "sync-config.json"
    cfg = load_config(config_path)
    cobb.set_log_dir(args.log_dir or config_path.parent)
    # Backwards-friendly log label: the adapter historically used student_name.
    cfg.setdefault("student_name", cfg_get(cfg, "child_name", default="the student"))

    service_key = credentials.get_service_role_key()
    sb = SupabaseClient(cfg["supabase_url"], service_key)

    child_slug = cfg["child_slug"]
    child = sb.resolve_child(child_slug)
    child_id = child["id"]
    device = cfg_get(cfg, "device_name", default="laptop")
    cobb.log(f"Config OK for '{child_slug}' on {device}. Supabase: {cfg['supabase_url']}")

    if args.store_password:
        pw = getpass.getpass(f"School password for {cfg['student_email']}: ")
        credentials.keychain_set(child_slug, pw)
        cobb.log("Password stored in the OS keychain.")
        return 0

    heartbeat(sb, device, child_id, status="idle")

    if args.request_sync:
        job = request_job(sb, child_id)
        cobb.log(f"SYNC NOW job queued: {(job or {}).get('id')}")
        return 0

    password = credentials.get_school_password(child_slug, child_id, sb)
    # Transient, memory-only: the adapter's SSO step reads this; it is never
    # written to disk or sent anywhere except the portal login form.
    cfg["_student_password"] = password

    if args.sync_now:
        cfg["_force_sync"] = True
    ok = run_with_retries(cfg, sb, child, password)
    # Scrub the transient secret before exit.
    cfg["_student_password"] = ""
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
