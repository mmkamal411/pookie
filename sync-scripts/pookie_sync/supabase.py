"""Supabase client for the sync pipeline (service_role).

The pipeline writes to tables that carry NO client write policies
(006: grades/grade_snapshots are sync-pipeline-only) — so every write goes
through the service_role key, which bypasses RLS by design. Reads (child
resolution, class cache) also use service_role for simplicity; nothing here
is ever exposed to a browser.

Child resolution: ``child_slug`` from config -> ``children.id``. The slug is
the only identity the config carries; the UUID is resolved once per run.
"""

import re

from .transport import http_request


def slugify(name):
    """Canonical class slug: 'H Chinese III' -> 'chinese-iii'."""
    s = re.sub(r"^H\s+", "", name or "", flags=re.I)  # strip Honors prefix
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return s or "class"


class SupabaseClient:
    def __init__(self, url, service_role_key):
        self.url = url.rstrip("/")
        self.key = service_role_key

    def _headers(self, extra=None):
        h = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
        }
        if extra:
            h.update(extra)
        return h

    def rpc(self, fn, args=None, timeout=60):
        """Call a SECURITY DEFINER RPC (sync_* / get_tenant_secret)."""
        return http_request(
            "POST",
            f"{self.url}/rest/v1/rpc/{fn}",
            headers=self._headers(),
            data=args or {},
            timeout=timeout,
        )

    def rest(self, method, path, body=None, timeout=30):
        return http_request(
            method,
            f"{self.url}/rest/v1/{path}",
            headers=self._headers(),
            data=body,
            timeout=timeout,
        )

    # ------------------------------------------------------------ tenancy ---
    def resolve_child(self, child_slug):
        """children.slug -> child row. Raises if the slug is unknown."""
        rows = self.rest(
            "GET",
            f"children?slug=eq.{child_slug}&select=id,slug,first_name,last_name,school_name",
        ) or []
        if not rows:
            raise RuntimeError(
                f"Unknown child_slug '{child_slug}' in the pookie project. "
                "Create the child in the app first."
            )
        return rows[0]

    def load_classes(self, child_id):
        """All classes rows for the child (the class cache for name matching)."""
        return self.rest(
            "GET",
            f"classes?child_id=eq.{child_id}&select=id,class_slug,name,display_name,aliases,teacher_email",
        ) or []

    def match_class(self, sv_name, classes):
        """Match a StudentVUE class name to a classes row.

        Returns (row_or_None, class_slug). Match order: exact slug,
        alias hit, normalized substring. Falls back to a fresh slug so the
        upsert RPC can create the class row (grades are never dropped).
        """
        needle = (sv_name or "").strip()
        want = slugify(needle)
        for row in classes:
            if row.get("class_slug") == want:
                return row, row["class_slug"]
        low = needle.lower()
        for row in classes:
            aliases = [str(a).lower() for a in (row.get("aliases") or [])]
            if low in aliases or any(a in low or low in a for a in aliases if a):
                return row, row["class_slug"]
            if row.get("name") and row["name"].lower() in low:
                return row, row["class_slug"]
        return None, want
