"""Credential resolution. OS keychain first, Pookie vault second, never hardcoded.

Secrets handled here:
  - ``POOKIE_SERVICE_ROLE_KEY`` / ``~/.pookie/service-role.key`` (mode 0600):
    the sync pipeline writes via service_role (006 gives the pipeline tables
    no client write policies — service_role bypasses RLS by design).
  - Student school password: OS keychain (service ``pookie-sync``,
    account ``<child-slug>:studentvue-password``) -> Pookie vault
    ``get_tenant_secret(child_id, 'studentvue-password')``.

Nothing in this module ever prints or logs a secret value.
"""

import os
import stat
import sys
from pathlib import Path

KEYCHAIN_SERVICE = "pookie-sync"
VAULT_SYSTEM_PASSWORD = "studentvue-password"


class CredentialError(RuntimeError):
    pass


def get_service_role_key():
    """Resolve the pookie project's service_role key.

    Order: POOKIE_SERVICE_ROLE_KEY env -> ~/.pookie/service-role.key (0600).
    Refuses to use a world-readable key file.
    """
    env_key = os.environ.get("POOKIE_SERVICE_ROLE_KEY", "").strip()
    if env_key:
        return env_key
    key_file = Path.home() / ".pookie" / "service-role.key"
    if key_file.exists():
        mode = stat.S_IMODE(key_file.stat().st_mode)
        if mode & 0o077:
            raise CredentialError(
                f"{key_file} is readable by others (mode {oct(mode)}). "
                "Run: chmod 600 on the file, or set POKIE_SERVICE_ROLE_KEY."
            )
        return key_file.read_text(encoding="utf-8").strip()
    raise CredentialError(
        "No service_role key found. Set POKIE_SERVICE_ROLE_KEY or write "
        "~/.pookie/service-role.key (chmod 600)."
    )


def keychain_get(child_slug):
    """Read the school password from the OS keychain. None if unavailable."""
    try:
        import keyring
    except ImportError:
        return None
    try:
        return keyring.get_password(KEYCHAIN_SERVICE, f"{child_slug}:studentvue-password")
    except Exception:
        return None


def keychain_set(child_slug, password):
    """Store the school password in the OS keychain (install step)."""
    import keyring

    keyring.set_password(KEYCHAIN_SERVICE, f"{child_slug}:studentvue-password", password)


def get_school_password(child_slug, child_id, sb):
    """Resolve the student's school portal password.

    Order: POKIE_STUDENT_PASSWORD env (install-time escape hatch) ->
    OS keychain -> Pookie vault get_tenant_secret (service_role-only RPC).
    """
    env_pw = os.environ.get("POKIE_STUDENT_PASSWORD", "")
    if env_pw:
        return env_pw

    pw = keychain_get(child_slug)
    if pw:
        return pw

    # Pookie vault fallback — the worker is service_role, which is the only
    # role the get_tenant_secret RPC answers to (003, tenant_membership_required
    # guard). Best-effort: not every tenant stores the portal password there.
    if sb is not None and child_id:
        try:
            secret = sb.rpc("get_tenant_secret", {
                "p_child_id": child_id,
                "p_system": VAULT_SYSTEM_PASSWORD,
            })
            if secret:
                return secret
        except Exception:
            pass

    raise CredentialError(
        f"No school password for child '{child_slug}'. Install steps:\n"
        f"  python3 -m pookie_sync.main --store-password --config sync-config.json\n"
        "or enter the password in the Portals UI (stored in the Pookie vault)."
    )
