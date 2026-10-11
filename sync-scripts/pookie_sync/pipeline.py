"""Sync pipeline: claim -> sweep -> upsert -> finish.

E2E data flow (new multi-tenant project):
  portal (StudentVUE/Office365)
    -> adapters/cobb.py sweep (plain dicts, no student identity hardcoded)
    -> build_sweep_payload(): map to the 006 schema, every row carrying
       child_id + class_slug resolved against the classes table
    -> sync_upsert_sweep RPC (atomic): grades upsert (child_id,class_id,term),
       grade_snapshots append, assignments upsert (child_id,class_id,source_id),
       teacher_messages inbound insert (deduped)
    -> sync_finish_job
  The app then reads: grades (current), due_next (view over assignments),
  grade_snapshots (trend/drop alerts), teacher_messages (inbox).

Idempotency: the payload is a pure function of the sweep. Running the same
sweep twice produces identical upsert keys, so re-runs are safe.
"""

import hashlib
import re
from datetime import datetime, timezone

from .adapters import cobb
from .config import cfg_get
from .queue import (
    append_log,
    claim_job,
    finish_job,
    heartbeat,
)
from .supabase import slugify


def _school_year(reference=None):
    """School year the given date belongs to (starts in August)."""
    ref = reference or datetime.now()
    return ref.year if ref.month >= 8 else ref.year - 1


def parse_due_date(date_str, week_str=None, reference=None):
    """Parse StudentVUE date badges ('AUG 10', separate 'AUG'/'10' lines) to ISO.

    Returns an ISO-8601 date string or None. Year is inferred from the
    school-year calendar (Aug -> current year, Jan-Jul -> next year).
    """
    if not date_str:
        return None
    m = re.match(
        r"^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{1,2})$",
        date_str.strip(), re.I,
    )
    if not m:
        return None
    months = {n: i + 1 for i, n in enumerate(
        ["JAN", "FEB", "MAR", "APR", "MAY", "JUN",
         "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"])}
    month = months[m.group(1).upper()]
    day = int(m.group(2))
    year = _school_year(reference)
    if month < 8:
        year += 1  # spring semester of the school year
    try:
        return f"{year:04d}-{month:02d}-{day:02d}"
    except ValueError:
        return None


def assignment_source_id(class_slug, title, week, date):
    """Adapter-stable id for assignments -> UNIQUE (child_id, class_id, source_id)."""
    raw = f"sv:{class_slug}:{title}|{week}|{date}".lower()
    return "sv:" + hashlib.sha1(raw.encode()).hexdigest()[:32]


def assignment_status(a, due_iso):
    """graded when a percent exists; upcoming otherwise.

    Deliberately never infers 'missing' from heuristics — a missing flag
    without portal evidence would corrupt the parent's view. Manual rows and
    future portal fields can set missing/late explicitly.
    """
    if a.get("percent") is not None:
        return "graded"
    return "upcoming"


def build_sweep_payload(sv_data, o365_emails, sb, child_id, term):
    """Map raw sweep dicts to the 006-schema payload for sync_upsert_sweep.

    Returns {"classes": [...], "grades": [...], "assignments": [...],
    "messages": [...]}. Pure function of its inputs (idempotent).
    """
    classes = sb.load_classes(child_id)
    by_slug = {}   # class_slug -> {slug, name, period, teacher...}
    seen_order = []

    def ensure_class(sv_name, period="", teacher_name="", teacher_email=""):
        _row, slug = sb.match_class(sv_name, classes)
        if slug not in by_slug:
            by_slug[slug] = {
                "class_slug": slug,
                "name": (sv_name or "")[:120],
                "period": (period or "")[:20],
                "teacher_name": (teacher_name or "")[:120],
                "teacher_email": (teacher_email or "")[:160],
            }
            seen_order.append(slug)
        return slug

    # --- classes + grades (current numeric per class per term) ---
    grades = []
    for g in sv_data.get("grades", []):
        slug = ensure_class(g.get("class", ""), period=g.get("period", ""))
        numeric = g.get("grade")
        grades.append({
            "class_slug": slug,
            "numeric": round(float(numeric), 2) if numeric is not None else None,
            "term": g.get("period") or term,
            "source": "studentvue",
        })

    # --- assignments (per-class drilldown detail) ---
    assignments = []
    for detail in sv_data.get("class_details", []):
        if not isinstance(detail, dict):
            continue
        slug = ensure_class(
            detail.get("class", ""),
            period=detail.get("period", ""),
        )
        for a in detail.get("assignments", []):
            title = (a.get("title") or "")[:200]
            if not title:
                continue
            due_iso = parse_due_date(a.get("date", ""), a.get("week", ""))
            max_pts = a.get("max_points")
            score = a.get("score")
            assignments.append({
                "class_slug": slug,
                "source_id": assignment_source_id(
                    slug, title, a.get("week", ""), a.get("date", "")),
                "title": title,
                "category": (a.get("category") or "")[:80] or None,
                "due_date": f"{due_iso}T00:00:00Z" if due_iso else None,
                "status": assignment_status(a, due_iso),
                "points_earned": float(score) if score is not None else None,
                "points_possible": float(max_pts) if max_pts is not None else None,
                "notes": f"week {a.get('week')}" if a.get("week") else None,
            })

    # --- inbound teacher messages (Synergy mail + Office 365) ---
    messages = []
    for m in sv_data.get("synergy_mail", []):
        messages.append(_message_row(sb, classes, ensure_class, m,
                                     thread_prefix="synergy"))
    for m in o365_emails or []:
        messages.append(_message_row(sb, classes, ensure_class, m,
                                     thread_prefix="outlook"))

    return {
        "classes": [by_slug[s] for s in seen_order],
        "grades": grades,
        "assignments": assignments,
        "messages": [m for m in messages if m],
    }


def _message_row(sb, classes, ensure_class, m, thread_prefix):
    subject = (m.get("subject") or "")[:200]
    body = m.get("body") or m.get("preview") or ""
    if not subject and not body:
        return None
    # Best-effort class attribution via the sender's teacher email.
    sender = (m.get("sender") or "").lower()
    class_slug = None
    for row in classes:
        tem = (row.get("teacher_email") or "").lower()
        if tem and tem in sender:
            class_slug = row["class_slug"]
            break
    thread_key = f"{thread_prefix}:{subject}:{m.get('date', '')}"[:200]
    return {
        "class_slug": class_slug,          # None = counselor/general
        "direction": "inbound",
        "subject": subject or None,
        "body": body[:8000],
        "thread_key": thread_key,
        "sent_at": None,                   # portal dates are display strings; kept in body
    }


def do_sync(cfg, sb, child, password):
    """Run one full sync: claim -> sweep -> upsert -> finish."""
    child_id = child["id"]
    child_slug = child["slug"]
    device = cfg_get(cfg, "device_name", default="laptop")
    term = cfg_get(cfg, "current_term", default="GP2")

    if cfg.get("_force_sync"):
        job = {"id": "forced-" + datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")}
        cobb.log("Forced sync: bypassing queue.")
    else:
        job = claim_job(sb, child_id)
        if not job:
            cobb.log("No pending sync.")
            return None
    job_id = job.get("id") if isinstance(job, dict) else job
    is_real_job = not cfg.get("_force_sync")

    def qlog(msg, level="info"):
        cobb.log(msg, level)
        if is_real_job:
            append_log(sb, job_id, msg, level)

    cobb.set_queue_logger(lambda msg, level="info": append_log(sb, job_id, msg, level)
                          if is_real_job else None)
    cobb.log(f"Worker ({device}) picked up the sync for child '{child_slug}'.")
    if is_real_job:
        append_log(sb, job_id, f"Worker ({device}) picked up the sync.")
    heartbeat(sb, device, child_id, status="working",
              job_id=job_id if isinstance(job_id, str) and len(job_id) == 36 else None)

    try:
        sv_data = cobb.sweep_studentvue(cfg, job_id, password)
        qlog(f"Found {len(sv_data['grades'])} classes, "
             f"{len(sv_data.get('due_next', []))} upcoming items.")

        o365_emails = cobb.sweep_office365(cfg, job_id, password)
        qlog(f"Pulled {len(o365_emails)} teacher emails from Office 365.")

        if cfg.get("enable_ctls_sweep"):
            sv_data["ctls_syllabi"] = cobb.sweep_ctls_learn(cfg, job_id, password)

        payload = build_sweep_payload(sv_data, o365_emails, sb, child_id, term)
        qlog(f"Payload: {len(payload['classes'])} classes, "
             f"{len(payload['grades'])} grades, "
             f"{len(payload['assignments'])} assignments, "
             f"{len(payload['messages'])} messages.")

        result = sb.rpc("sync_upsert_sweep", {
            "p_child_id": child_id,
            "p_term": term,
            "p_sweep": payload,
        }, timeout=120)
        qlog(f"Upsert result: {result}")

        summary = (f"Sync complete ({device}) — {len(payload['grades'])} grades, "
                   f"{len(payload['assignments'])} assignments, "
                   f"{len(payload['messages'])} messages.")
        cobb.log(f"DONE: {summary}")
        if is_real_job:
            finish_job(sb, job_id, "complete", summary)
        heartbeat(sb, device, child_id, status="idle")
        return True

    except Exception as e:
        err = f"Sync failed ({device}): {e}"
        cobb.log(f"[err] {err}", "err")
        if is_real_job:
            append_log(sb, job_id, err, "err")
            finish_job(sb, job_id, "failed", err)
        heartbeat(sb, device, child_id, status="idle")
        raise
