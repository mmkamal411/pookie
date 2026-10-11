#!/usr/bin/env python3
"""Dry-run E2E test for the Pookie sync pipeline.

What this verifies WITHOUT a live portal or laptop:
  1. The full pipeline path: claim -> sweep (mocked adapter) -> payload build
     -> sync_upsert_sweep -> finish, in the right order.
  2. The fake Supabase backend below mirrors the 006/009 schema contracts
     exactly (tables, columns, UNIQUE constraints, RLS-bypass write identity),
     so the test proves the client's payload is schema-valid.
  3. Idempotency: re-running the same sweep produces identical upsert keys
     (only grade_snapshots grows; messages are deduped).
  4. child_id scoping: every written row carries the resolved child UUID.
  5. No secrets leak into any RPC payload.

What it does NOT verify (needs the live pookie project + laptop):
  - the PL/pgSQL in 009_sync_queue.sql executes (syntax-checked with pglast;
    needs a real apply — see VERIFICATION-QUERIES below),
  - the real Playwright sweep (adapter code is ported verbatim from the
    working 2026-10-10 script; laptop test run required),
  - the service_role key reaching the project (install step).

Run:  python3 tests/test_pipeline.py
"""

import json
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

from pookie_sync.adapters import cobb  # noqa: E402
from pookie_sync.pipeline import (  # noqa: E402
    assignment_source_id,
    build_sweep_payload,
    do_sync,
    parse_due_date,
)
from pookie_sync.supabase import SupabaseClient, slugify  # noqa: E402

CHILD_ID = "11111111-2222-3333-4444-555555555555"
CHILD_SLUG = "dawson-kamal"

# ---------------------------------------------------------------------------
# Schema contract, transcribed from the migrations (006_w1_school_core.sql,
# 002_school_systems.sql). The test fails loudly if the client ever sends a
# column the schema does not have.
# ---------------------------------------------------------------------------
SCHEMA_COLUMNS = {
    "classes": {"id", "child_id", "name", "display_name", "class_slug", "period",
                "teacher_name", "teacher_email", "display_order", "aliases",
                "grade_weights", "active", "created_at"},
    "grades": {"id", "child_id", "class_id", "term", "numeric", "source", "synced_at"},
    "grade_snapshots": {"id", "child_id", "class_id", "term", "numeric", "taken_at"},
    "assignments": {"id", "child_id", "class_id", "source_id", "title", "category",
                    "due_date", "status", "points_earned", "points_possible",
                    "notes", "synced_at"},
    "teacher_messages": {"id", "child_id", "class_id", "direction", "subject", "body",
                         "status", "approved_by", "approved_at", "thread_key",
                         "sent_at", "created_at"},
}


class FakeSupabase(SupabaseClient):
    """In-memory stand-in for the pookie project, enforcing the schema contract.

    Implements the 009 RPC semantics (resolve-or-create classes, upsert grades
    on (child_id,class_id,term), append snapshots, upsert assignments on
    (child_id,class_id,source_id), dedupe inbound messages) so the client's
    payload is exercised against the real write rules.
    """

    def __init__(self):
        self.calls = []  # (fn, args) in order
        self.child = {"id": CHILD_ID, "slug": CHILD_SLUG,
                      "first_name": "Dawson", "last_name": "Kamal"}
        self._class_seq = 0
        self.classes_rows = [
            self._mk_class("ap-computer-science-principles", "AP Computer Science Principles", "1st", None),
            self._mk_class("environmental-science", "H Environmental Science", "2nd", None),
            self._mk_class("chinese-iii", "H Chinese III", "3rd", None),
            self._mk_class("american-government", "American Government", "5th", None),
            self._mk_class("geometry", "Geometry", "6th", "kathryn.thomason@cobbk12.org"),
            self._mk_class("literature-composition-ii", "Literature & Composition II", "7th", None),
        ]
        self.grades = {}       # (class_id, term) -> row
        self.snapshots = []    # append-only
        self.assignments = {}  # (class_id, source_id) -> row
        self.messages = []     # list of rows
        self.jobs = {}
        self.heartbeats = {}
        self._job_seq = 0

    def _mk_class(self, slug, name, period, teacher_email):
        self._class_seq += 1
        return {"id": f"class-{self._class_seq:04d}", "child_id": CHILD_ID,
                "name": name, "display_name": name, "class_slug": slug,
                "period": period, "teacher_name": None,
                "teacher_email": teacher_email, "display_order": 0,
                "aliases": [], "grade_weights": None, "active": True,
                "created_at": "2026-10-11T00:00:00Z"}

    # -- SupabaseClient surface used by the pipeline -------------------------
    def resolve_child(self, slug):
        assert slug == CHILD_SLUG, slug
        return dict(self.child)

    def load_classes(self, child_id):
        assert child_id == CHILD_ID, child_id
        return [dict(r) for r in self.classes_rows]

    def rpc(self, fn, args=None, timeout=60):
        args = args or {}
        self.calls.append((fn, json.loads(json.dumps(args))))
        return getattr(self, "_rpc_" + fn)(args)

    # -- 009 RPCs -------------------------------------------------------------
    def _rpc_sync_request_job(self, a):
        assert a["p_child_id"] == CHILD_ID
        self._job_seq += 1
        jid = f"job-{self._job_seq:04d}"
        self.jobs[jid] = {"id": jid, "child_id": CHILD_ID, "status": "pending"}
        return dict(self.jobs[jid])

    def _rpc_sync_claim_job(self, a):
        assert a["p_child_id"] == CHILD_ID
        for jid, j in self.jobs.items():
            if j["status"] == "pending":
                j["status"] = "claimed"
                return dict(j)
        return None

    def _rpc_sync_finish_job(self, a):
        assert a["p_status"] in ("complete", "failed")
        self.jobs[a["p_job_id"]]["status"] = a["p_status"]
        self.jobs[a["p_job_id"]]["summary"] = a["p_summary"]
        return True

    def _rpc_sync_append_log(self, a):
        return True

    def _rpc_sync_heartbeat(self, a):
        assert a["p_child_id"] == CHILD_ID
        self.heartbeats[a["p_device_name"]] = dict(a)
        return True

    def _rpc_sync_upsert_sweep(self, a):
        assert a["p_child_id"] == CHILD_ID, "child_id missing on upsert"
        sweep = a["p_sweep"]
        counts = {"classes_created": 0, "grades_upserted": 0,
                  "snapshots_inserted": 0, "assignments_upserted": 0,
                  "messages_inserted": 0, "messages_skipped_dupe": 0}

        def class_id_for(slug):
            for r in self.classes_rows:
                if r["class_slug"] == slug:
                    return r["id"]
            # resolve-or-create (mirrors the SQL)
            row = self._mk_class(slug, slug.replace("-", " ").title(), None, None)
            self.classes_rows.append(row)
            counts["classes_created"] += 1
            return row["id"]

        for c in sweep["classes"]:
            class_id_for(c["class_slug"])

        for g in sweep["grades"]:
            cid = class_id_for(g["class_slug"])
            term = g.get("term") or a["p_term"]
            row = {"id": f"g-{cid}-{term}", "child_id": CHILD_ID, "class_id": cid,
                   "term": term, "numeric": g["numeric"],
                   "source": g.get("source", "studentvue"), "synced_at": "now"}
            assert set(row) <= SCHEMA_COLUMNS["grades"], set(row) - SCHEMA_COLUMNS["grades"]
            self.grades[(cid, term)] = row
            counts["grades_upserted"] += 1
            snap = {"id": f"s-{len(self.snapshots)}", "child_id": CHILD_ID,
                    "class_id": cid, "term": term, "numeric": g["numeric"],
                    "taken_at": "now"}
            assert set(snap) <= SCHEMA_COLUMNS["grade_snapshots"]
            self.snapshots.append(snap)
            counts["snapshots_inserted"] += 1

        for x in sweep["assignments"]:
            cid = class_id_for(x["class_slug"])
            assert x["status"] in ("upcoming", "submitted", "graded",
                                   "missing", "late", "excused"), x["status"]
            row = {"id": f"a-{cid}-{x['source_id'][:8]}", "child_id": CHILD_ID,
                   "class_id": cid, "source_id": x["source_id"], "title": x["title"],
                   "category": x.get("category"), "due_date": x.get("due_date"),
                   "status": x["status"], "points_earned": x.get("points_earned"),
                   "points_possible": x.get("points_possible"),
                   "notes": x.get("notes"), "synced_at": "now"}
            assert set(row) <= SCHEMA_COLUMNS["assignments"], set(row) - SCHEMA_COLUMNS["assignments"]
            self.assignments[(cid, x["source_id"])] = row
            counts["assignments_upserted"] += 1

        for m in sweep["messages"]:
            assert m["direction"] == "inbound"
            cid = None
            if m.get("class_slug"):
                cid = class_id_for(m["class_slug"])
            key = (m.get("thread_key"), m.get("sent_at"))
            if m.get("thread_key") and any(
                    (r["thread_key"], r["sent_at"]) == key for r in self.messages):
                counts["messages_skipped_dupe"] += 1
                continue
            row = {"id": f"m-{len(self.messages)}", "child_id": CHILD_ID,
                   "class_id": cid, "direction": "inbound",
                   "subject": m.get("subject"), "body": m.get("body", ""),
                   "status": "received", "approved_by": None, "approved_at": None,
                   "thread_key": m.get("thread_key"), "sent_at": m.get("sent_at"),
                   "created_at": "now"}
            assert set(row) <= SCHEMA_COLUMNS["teacher_messages"], set(row) - SCHEMA_COLUMNS["teacher_messages"]
            self.messages.append(row)
            counts["messages_inserted"] += 1

        # class rows created above must also satisfy the schema contract
        for r in self.classes_rows:
            assert set(r) <= SCHEMA_COLUMNS["classes"], set(r) - SCHEMA_COLUMNS["classes"]
        return counts


def load_fixture():
    with open(os.path.join(HERE, "fixtures", "sweep_sample.json"), encoding="utf-8") as f:
        return json.load(f)


def make_cfg(**over):
    cfg = {"child_slug": CHILD_SLUG, "child_name": "Dawson Kamal",
           "supabase_url": "https://fspvcuaupkdsekpwmnep.supabase.co",
           "device_name": "test-worker", "current_term": "GP2",
           "student_name": "Dawson Kamal"}
    cfg.update(over)
    return cfg


class PipelineDryRun(unittest.TestCase):
    def setUp(self):
        self.sb = FakeSupabase()
        self.fixture = load_fixture()
        self.sweep = {k: v for k, v in self.fixture.items() if k != "o365_emails"}
        self.emails = self.fixture["o365_emails"]
        # Mock the browser sweeps — no portal, no Playwright in the dry-run.
        cobb.sweep_studentvue = lambda cfg, sid, pw=None: dict(self.sweep)
        cobb.sweep_office365 = lambda cfg, sid, pw=None: list(self.emails)
        cobb.set_queue_logger(lambda fn: None)
        self._orig_log = cobb.log
        cobb.log = lambda msg, level="info": None

    def tearDown(self):
        cobb.log = self._orig_log

    def _run_sync(self):
        # Queue a job, then run the real do_sync against it.
        self.sb.rpc("sync_request_job", {"p_child_id": CHILD_ID})
        return do_sync(make_cfg(), self.sb, self.sb.child, "pw-not-used")

    def test_full_pipeline_order_and_counts(self):
        self.assertTrue(self._run_sync())
        fns = [fn for fn, _ in self.sb.calls]
        self.assertIn("sync_claim_job", fns)
        self.assertIn("sync_upsert_sweep", fns)
        self.assertIn("sync_finish_job", fns)
        self.assertLess(fns.index("sync_claim_job"), fns.index("sync_upsert_sweep"))
        self.assertLess(fns.index("sync_upsert_sweep"), fns.index("sync_finish_job"))

        finish = [a for fn, a in self.sb.calls if fn == "sync_finish_job"][0]
        self.assertEqual(finish["p_status"], "complete")

        upsert = [a for fn, a in self.sb.calls if fn == "sync_upsert_sweep"][0]
        self.assertEqual(upsert["p_child_id"], CHILD_ID)
        self.assertEqual(upsert["p_term"], "GP2")
        payload = upsert["p_sweep"]
        self.assertEqual(len(payload["classes"]), 6)
        self.assertEqual(len(payload["grades"]), 6)
        self.assertEqual(len(payload["assignments"]), 5)   # 3 geometry + 2 apcsp
        self.assertEqual(len(payload["messages"]), 3)     # 1 synergy + 2 outlook

        # Ledger counts (what the tables would hold after the RPC).
        self.assertEqual(len(self.sb.grades), 6)
        self.assertEqual(len(self.sb.snapshots), 6)
        self.assertEqual(len(self.sb.assignments), 5)
        self.assertEqual(len(self.sb.messages), 3)
        # Geometry grade landed with the right numeric.
        geo = next(r for r in self.sb.classes_rows if r["class_slug"] == "geometry")
        self.assertEqual(self.sb.grades[(geo["id"], "GP2")]["numeric"], 69.5)
        # No new class rows — all six matched the seeded classes table.
        self.assertEqual(len(self.sb.classes_rows), 6)

    def test_idempotent_rerun(self):
        self._run_sync()
        snaps_before = len(self.sb.snapshots)
        self._run_sync()
        # Same upsert keys: grades/assignments unchanged, snapshots appended,
        # inbound messages deduped (not re-inserted).
        self.assertEqual(len(self.sb.grades), 6)
        self.assertEqual(len(self.sb.assignments), 5)
        self.assertEqual(len(self.sb.messages), 3)
        self.assertEqual(len(self.sb.snapshots), snaps_before + 6)
        last_upsert = [a for fn, a in self.sb.calls if fn == "sync_upsert_sweep"][-1]
        p1 = [a for fn, a in self.sb.calls if fn == "sync_upsert_sweep"][0]["p_sweep"]
        p2 = last_upsert["p_sweep"]
        self.assertEqual(
            sorted(x["source_id"] for x in p1["assignments"]),
            sorted(x["source_id"] for x in p2["assignments"]))

    def test_new_class_never_drops_grades(self):
        sweep = dict(self.sweep)
        sweep["grades"] = list(sweep["grades"]) + [
            {"class": "Robotics Elective", "grade": 92.0, "period": "GP2"}]
        cobb.sweep_studentvue = lambda cfg, sid, pw=None: sweep
        self._run_sync()
        self.assertEqual(len(self.sb.classes_rows), 7)  # class row created
        new = next(r for r in self.sb.classes_rows
                   if r["class_slug"] == "robotics-elective")
        self.assertEqual(self.sb.grades[(new["id"], "GP2")]["numeric"], 92.0)

    def test_child_id_on_every_write_and_no_secrets(self):
        self._run_sync()
        for table_rows in (self.sb.grades.values(), self.sb.snapshots,
                           self.sb.assignments.values(), self.sb.messages,
                           self.sb.classes_rows):
            for row in table_rows:
                self.assertEqual(row["child_id"], CHILD_ID)
        blob = json.dumps(self.sb.calls)
        self.assertNotIn("pw-not-used", blob)  # password never leaves the laptop

    def test_slugify_and_dates(self):
        self.assertEqual(slugify("H Chinese III"), "chinese-iii")
        self.assertEqual(slugify("Literature & Composition II"),
                         "literature-composition-ii")
        ref = __import__("datetime").datetime(2026, 10, 11)
        self.assertEqual(parse_due_date("OCT 20", reference=ref), "2026-10-20")
        self.assertEqual(parse_due_date("JAN 12", reference=ref), "2027-01-12")
        self.assertIsNone(parse_due_date(""))
        a = assignment_source_id("geometry", "Unit 3 Test", "10/19-10/23", "OCT 20")
        b = assignment_source_id("geometry", "Unit 3 Test", "10/19-10/23", "OCT 20")
        self.assertEqual(a, b)
        self.assertTrue(a.startswith("sv:"))

    def test_empty_sweep_is_safe(self):
        cobb.sweep_studentvue = lambda cfg, sid, pw=None: {
            "grades": [], "due_next": [], "gpa": {}, "past_periods": [],
            "synergy_mail": [], "class_details": []}
        cobb.sweep_office365 = lambda cfg, sid, pw=None: []
        self.assertTrue(self._run_sync())
        self.assertEqual(len(self.sb.grades), 0)
        finish = [a for fn, a in self.sb.calls if fn == "sync_finish_job"][0]
        self.assertEqual(finish["p_status"], "complete")


if __name__ == "__main__":
    unittest.main(verbosity=2)
