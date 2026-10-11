"""Config loader. Everything comes from sync-config.json + environment —
no student/district values are hardcoded anywhere in the package.

Secret policy (standing rule): credentials are NEVER stored in config or
code. Resolution order for each secret is:
  1. explicit environment variable (documented escape hatch for install-time),
  2. OS keychain via ``keyring`` (Windows Credential Manager / macOS Keychain),
  3. the Pookie credential vault via the service_role-only
     ``get_tenant_secret`` RPC (003) — the worker already holds service_role.
"""

import json
import os
import sys
from pathlib import Path

# ---------------------------------------------------------------- defaults ---
DEFAULTS = {
    # Supabase (new multi-tenant project). Key comes from env/protected file,
    # never from this config — see credentials.get_service_role_key().
    "supabase_url": "https://fspvcuaupkdsekpwmnep.supabase.co",
    # Tenancy — child_slug resolves to children.id at runtime.
    "child_slug": "",
    "child_name": "",
    "school_system_key": "cobb-county-ga",
    "current_term": "GP2",
    # StudentVUE portal (Cobb). Username is config; password is keychain/vault.
    "student_email": "",
    "studentvue_base_url": "https://studentvue.cobbk12.org",
    "studentvue_login_path": "/PXP2_Login_Student.aspx",
    "studentvue_gradebook_paths": [
        "/PXP2_GradeBook.aspx?AGU=0",
        "/PXP2_Grades.aspx?AGU=0",
    ],
    "studentvue_messages_paths": [
        "/PXP2_Messages.aspx?AGU=0",
        "/PXP2_Mail.aspx?AGU=0",
    ],
    "synergy_sso_url": "https://synergy.cobbk12.org/samlssoportal.aspx?whr=https://sts.windows.net/2fce1dfb-919f-4938-aab8-c47f0fc9182d/",
    "outlook_url": "https://office365.cobbk12.org/",
    "teacher_email_domain": "cobbk12.org",
    # CTLS Learn sweep is OFF by default — Mehedi provides syllabus links directly.
    "enable_ctls_sweep": False,
    "ctls_learn_url": "https://ctlslearn.cobbk12.org",
    # Known class name patterns (regex) — the parser only matches these.
    "class_name_patterns": [],
    # Device / source label (appears in the sync queue + heartbeats).
    "device_name": "laptop",
    # Retry behavior
    "max_retries": 10,
    "retry_base_delay": 60,
    "retry_max_delay": 1800,
    # Browser
    "browser_timeout": 60000,
    "headless": True,
}

REQUIRED = {
    "child_slug": "child slug in the pookie project (e.g. dawson-kamal)",
    "student_email": "student's school email address",
    "supabase_url": "Supabase project URL",
}


def load_config(path):
    """Load and validate sync-config.json. Exits with a message on problems."""
    path = Path(path)
    if not path.exists():
        sys.exit(
            f"Missing {path}.\n"
            "Copy sync-config.json.example to sync-config.json and fill it in."
        )
    raw = json.loads(path.read_text(encoding="utf-8"))
    cfg = dict(DEFAULTS)
    cfg.update(raw)

    missing = [k for k in REQUIRED if not cfg.get(k) or str(cfg[k]).startswith("PASTE_")]
    if missing:
        sys.exit("sync-config.json missing: " + ", ".join(f"{k} ({REQUIRED[k]})" for k in missing))

    for k in ("max_retries", "retry_base_delay", "retry_max_delay", "browser_timeout"):
        try:
            cfg[k] = int(cfg[k])
        except (ValueError, TypeError):
            cfg[k] = DEFAULTS[k]
    cfg["headless"] = bool(cfg.get("headless", True))
    cfg["enable_ctls_sweep"] = bool(cfg.get("enable_ctls_sweep", False))
    return cfg


def cfg_get(cfg, *keys, default=""):
    """First non-empty value from a list of key aliases."""
    for k in keys:
        v = cfg.get(k)
        if v:
            return v
    return default
