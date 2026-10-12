#!/usr/bin/env python3
"""telemetry.health — shared sync-health reporter for Squad Telemetry pull scripts.

Every school-data pull (E1 parent cron, E2 student/laptop worker, E3
email/calendar) reports its run lifecycle here. Writes go to the pookie
Supabase project:

  public.school_sync_health  — 1 row per (child_id, source_name, machine).
                                THE status-dashboard contract.
  public.school_sync_runs    — append-only per-run log (90-day retention).

Auth: service_role key (bypasses RLS). Read from the environment::

    POOKIE_SUPABASE_URL          e.g. https://fspvcuaupkdsekpwmnep.supabase.co
    POOKIE_SERVICE_ROLE_KEY      from the Secure Vault — NEVER commit it.

Typical use::

    from telemetry.health import SyncHealthReporter

    reporter = SyncHealthReporter.from_env(child_id="<dawson-child-uuid>")

    with reporter.track("studentvue", machine="laptop", cadence="daily",
                        expected_freshness_hours=26,
                        next_scheduled_run="2026-10-13T07:00:00-04:00") as run:
        grades = pull_grades()            # your code here
        run.count("grades", len(grades))
        run.count("assignments", 42)
    # clean exit  -> success recorded (freshness recomputed)
    # exception   -> error recorded (error_text, consecutive_errors+1) and re-raised

Freshness rule (must match public.recompute_school_sync_health() in
migration 066 — keep them in sync):
    latest run failed                          -> 'error'
    never succeeded                            -> 'never'
    now - last_success_at > expected_freshness -> 'stale'
    else                                       -> 'fresh'

Machines: 'laptop' (Dawson's Windows laptop via RustDesk),
          'macbook' (Mehedi's MacBook), 'sandbox' (this VM / crons),
          'cloud' (Cloudflare worker / hosted pipeline).

Stdlib only (urllib). No third-party dependencies.
"""

from __future__ import annotations

import datetime as _dt
import json as _json
import os as _os
import urllib.request as _request
import urllib.error as _error


MACHINES = ("laptop", "macbook", "sandbox", "cloud")
CADENCES = ("hourly", "daily", "weekly", "manual")
STATUSES = ("fresh", "stale", "error", "never")


def _utcnow_iso() -> str:
    return _dt.datetime.now(_dt.timezone.utc).isoformat()


def compute_freshness(
    last_success_at: _dt.datetime | None,
    expected_freshness: _dt.timedelta,
    last_run_failed: bool,
    now: _dt.datetime | None = None,
) -> str:
    """Pure freshness rule. Mirrors recompute_school_sync_health() (SQL)."""
    now = now or _dt.datetime.now(_dt.timezone.utc)
    if last_run_failed:
        return "error"
    if last_success_at is None:
        return "never"
    if last_success_at.tzinfo is None:
        last_success_at = last_success_at.replace(tzinfo=_dt.timezone.utc)
    if now - last_success_at > expected_freshness:
        return "stale"
    return "fresh"


class HealthWriteError(RuntimeError):
    pass


class SyncHealthReporter:
    """Reports pull-script run lifecycle to school_sync_health / school_sync_runs."""

    def __init__(self, supabase_url: str, service_role_key: str, child_id: str):
        if not supabase_url or not service_role_key or not child_id:
            raise ValueError("supabase_url, service_role_key and child_id are required")
        self.base = supabase_url.rstrip("/")
        self.key = service_role_key
        self.child_id = child_id

    @classmethod
    def from_env(cls, child_id: str | None = None) -> "SyncHealthReporter":
        url = _os.environ.get("POOKIE_SUPABASE_URL", "").strip()
        key = _os.environ.get("POOKIE_SERVICE_ROLE_KEY", "").strip()
        child_id = child_id or _os.environ.get("POOKIE_CHILD_ID", "").strip()
        missing = [n for n, v in
                   (("POOKIE_SUPABASE_URL", url),
                    ("POOKIE_SERVICE_ROLE_KEY", key),
                    ("child_id", child_id)) if not v]
        if missing:
            raise HealthWriteError(
                "missing " + ", ".join(missing) +
                " — service_role key lives in the Secure Vault; never commit it")
        return cls(url, key, child_id)

    # -- low-level REST ----------------------------------------------------
    def _req(self, method: str, path: str, body: dict | None = None,
             prefer: str | None = None) -> object:
        data = _json.dumps(body).encode() if body is not None else None
        req = _request.Request(self.base + path, data=data, method=method)
        req.add_header("apikey", self.key)
        req.add_header("Authorization", "Bearer " + self.key)
        req.add_header("Content-Type", "application/json")
        req.add_header("Accept", "application/json")
        if prefer:
            req.add_header("Prefer", prefer)
        try:
            with _request.urlopen(req, timeout=30) as resp:
                raw = resp.read().decode()
                return _json.loads(raw) if raw.strip() else None
        except _error.HTTPError as exc:
            detail = exc.read().decode(errors="replace")[:2000]
            raise HealthWriteError(f"{method} {path} -> HTTP {exc.code}: {detail}")

    def _upsert_health(self, payload: dict) -> None:
        path = ("/rest/v1/school_sync_health"
                "?on_conflict=child_id,source_name,machine")
        self._req("POST", path, payload,
                  prefer="resolution=merge-duplicates,return=minimal")

    # -- public API --------------------------------------------------------
    def track(self, source_name: str, machine: str, cadence: str = "daily",
              expected_freshness_hours: float = 26,
              next_scheduled_run: str | None = None) -> "_RunContext":
        """Return a context manager tracking one pull run. See module docstring."""
        if not source_name or not source_name.strip():
            raise ValueError("source_name is required")
        if machine not in MACHINES:
            raise ValueError(f"machine must be one of {MACHINES}")
        if cadence not in CADENCES:
            raise ValueError(f"cadence must be one of {CADENCES}")
        return _RunContext(self, source_name.strip(), machine, cadence,
                           _dt.timedelta(hours=expected_freshness_hours),
                           next_scheduled_run)

    def refresh_statuses(self) -> int:
        """Recompute data_freshness_status for this child's rows (service-side).

        The dashboard API normally calls recompute_school_sync_health() with a
        user JWT; this is the service_role equivalent for cron jobs.
        Returns rows updated.
        """
        rows = self._req(
            "GET",
            "/rest/v1/school_sync_health"
            f"?child_id=eq.{self.child_id}"
            "&select=source_name,machine,last_run_finished,last_success_at,"
            "expected_freshness,error_text") or []
        updated = 0
        for r in rows:
            lsa = r.get("last_success_at")
            failed = bool(r.get("error_text")) and r.get("last_run_finished")
            if failed and lsa:
                last_run_failed = r["last_run_finished"] >= lsa
            else:
                last_run_failed = bool(failed)
            # parse postgres interval "26:00:00" or "1 day 02:00:00"
            status = compute_freshness(
                _dt.datetime.fromisoformat(lsa) if lsa else None,
                _parse_interval(r.get("expected_freshness") or "26:00:00"),
                last_run_failed)
            self._upsert_health({
                "child_id": self.child_id,
                "source_name": r["source_name"],
                "machine": r["machine"],
                "data_freshness_status": status,
            })
            updated += 1
        return updated


def _parse_interval(s: str) -> _dt.timedelta:
    # postgres interval text from PostgREST: "26:00:00" / "1 day 02:00:00" / "00:00:00"
    days = 0
    if "day" in s:
        day_part, s = s.split("day", 1)
        days = int(day_part.strip())
    h, m, sec = (s.strip().split(":") + ["0", "0", "0"])[:3]
    return _dt.timedelta(days=days, hours=int(h), minutes=int(m),
                         seconds=int(float(sec)))


class _RunContext:
    def __init__(self, reporter: SyncHealthReporter, source_name: str,
                 machine: str, cadence: str, expected_freshness: _dt.timedelta,
                 next_scheduled_run: str | None):
        self._r = reporter
        self.source_name = source_name
        self.machine = machine
        self.cadence = cadence
        self.expected_freshness = expected_freshness
        self.next_scheduled_run = next_scheduled_run
        self.counts: dict[str, int] = {}
        self._run_id: str | None = None
        self._started = _utcnow_iso()

    def count(self, table: str, n: int) -> None:
        """Record rows written to a table during this run."""
        self.counts[table] = self.counts.get(table, 0) + int(n)

    def __enter__(self) -> "_RunContext":
        # 1) open a run row
        rows = self._r._req(
            "POST", "/rest/v1/school_sync_runs", {
                "child_id": self._r.child_id,
                "source_name": self.source_name,
                "machine": self.machine,
                "started_at": self._started,
            }, prefer="return=representation")
        self._run_id = rows[0]["id"] if rows else None
        # 2) mark the health row as running (clear nothing until we know the outcome)
        self._r._upsert_health({
            "child_id": self._r.child_id,
            "source_name": self.source_name,
            "machine": self.machine,
            "cadence": self.cadence,
            "expected_freshness": f"{self.expected_freshness}",
            "last_run_started": self._started,
            "next_scheduled_run": self.next_scheduled_run,
        })
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        finished = _utcnow_iso()
        rows_pulled = sum(self.counts.values())
        if exc_type is None:
            status = compute_freshness(
                _dt.datetime.fromisoformat(finished), self.expected_freshness, False)
            self._r._upsert_health({
                "child_id": self._r.child_id,
                "source_name": self.source_name,
                "machine": self.machine,
                "last_run_finished": finished,
                "last_success_at": finished,
                "rows_pulled": rows_pulled,
                "rows_by_table": self.counts,
                "error_text": None,
                "consecutive_errors": 0,
                "data_freshness_status": status,
            })
            self._finish_run(finished, rows_pulled, True, None)
            return False
        err = f"{exc_type.__name__}: {exc}"[:2000]
        # consecutive_errors must increment — read current value first
        cur = self._r._req(
            "GET",
            "/rest/v1/school_sync_health"
            f"?child_id=eq.{self._r.child_id}"
            f"&source_name=eq.{self.source_name}"
            f"&machine=eq.{self.machine}"
            "&select=consecutive_errors,last_success_at") or []
        consec = (cur[0].get("consecutive_errors") or 0) + 1 if cur else 1
        self._r._upsert_health({
            "child_id": self._r.child_id,
            "source_name": self.source_name,
            "machine": self.machine,
            "last_run_finished": finished,
            "rows_pulled": rows_pulled,
            "rows_by_table": self.counts,
            "error_text": err,
            "consecutive_errors": consec,
            "data_freshness_status": "error",
        })
        self._finish_run(finished, rows_pulled, False, err)
        return False  # re-raise

    def _finish_run(self, finished: str, rows_pulled: int,
                    success: bool, error_text: str | None) -> None:
        if not self._run_id:
            return
        self._r._req(
            "PATCH", f"/rest/v1/school_sync_runs?id=eq.{self._run_id}", {
                "finished_at": finished,
                "rows_pulled": rows_pulled,
                "rows_by_table": self.counts,
                "error_text": error_text,
                "success": success,
            }, prefer="return=minimal")
