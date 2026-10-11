"""Sync queue against the new project's RPCs (009_sync_queue.sql).

Pattern (unchanged from the old project, child-scoped now):
  claim -> sweep -> upsert -> finish.

RPC names follow the NEW project's conventions (plain names like
consume_invite — NOT the old project's ``rpc_`` prefix). All five RPCs are
SECURITY DEFINER + service_role-only; the worker is the only caller.
"""

CLAIM_TIMEOUT = 60


def claim_job(sb, child_id):
    """Claim the oldest pending sync job for this child. None if empty."""
    try:
        result = sb.rpc("sync_claim_job", {"p_child_id": child_id}, timeout=CLAIM_TIMEOUT)
    except Exception:
        return None
    if isinstance(result, list):
        return result[0] if result else None
    return result


def request_job(sb, child_id):
    """Insert a pending job (SYNC NOW path). Returns the new job row."""
    result = sb.rpc("sync_request_job", {"p_child_id": child_id})
    if isinstance(result, list):
        return result[0] if result else None
    return result


def finish_job(sb, job_id, status, summary):
    """Mark a job complete/failed. Best-effort wrapper (never raises)."""
    try:
        sb.rpc("sync_finish_job", {
            "p_job_id": job_id,
            "p_status": status,
            "p_summary": (summary or "")[:2000],
        })
    except Exception:
        pass


def append_log(sb, job_id, line, level="info"):
    """Append a line to the job's log. Best-effort (never raises)."""
    if not job_id:
        return
    try:
        sb.rpc("sync_append_log", {
            "p_job_id": job_id,
            "p_line": (line or "")[:2000],
            "p_level": level,
        })
    except Exception:
        pass


def heartbeat(sb, device_name, child_id, status="idle", job_id=None):
    """Update the worker heartbeat. Best-effort (never raises)."""
    try:
        sb.rpc("sync_heartbeat", {
            "p_device_name": device_name,
            "p_child_id": child_id,
            "p_status": status,
            "p_job_id": job_id,
        })
    except Exception:
        pass
