# Pookie Sync — Laptop Install & Test Runbook

**Scope:** install + test the NEW multi-tenant sync scripts ONLY.
The OLD Dawson scripts keep running against the OLD project untouched —
nothing here renames, moves, or edits them. New and old run in parallel
until the founder calls cutover.

**Hard prerequisite (DBA, do this first):** apply
`supabase/migrations/009_sync_queue.sql` to the pookie project
(`fspvcuaupkdsekpwmnep`) and confirm the child row exists
(`SELECT id, slug FROM children WHERE slug='dawson-kamal';`).
The sync creates missing `classes` rows itself; grades/assignments/messages
flow from there.

**What gets installed (per machine):**
- `pookie_sync/` — the canonical package (same code on both platforms)
- `pookie-sync-windows.py` / `pookie-sync-mac.py` — thin platform wrappers
- `sync-config.json` — config (child slug, portal URLs, device name;
  **no secrets in this file, ever**)

**Secrets (never hardcoded, never in config):**
- Supabase service_role key → `POOKIE_SERVICE_ROLE_KEY` env var
  or `~/.pookie/service-role.key` (mode 600; the script refuses a
  world-readable key file)
- School portal password → OS keychain via
  `python3 <wrapper> --store-password --config sync-config.json`
  (Windows Credential Manager / macOS Keychain, service `pookie-sync`),
  with fallback to the Pookie vault (`get_tenant_secret`)

---

## Machine 1 — Windows laptop (priority: passes Cobb Conditional Access)

RustDesk ID `156762285` ("dashawnalien"); credentials in Secure Vault under
`rustdesk.com`. Enable FULL SCREEN on login.

**0. Snapshot the working script FIRST** (Python Work Protocol):
```powershell
cd C:\dawson-sync
copy dawson-windows-sync.py dawson-windows-sync.py.WORKING-20261011
```
Leave the original exactly where it is — its scheduled task keeps running.

**1. Stage the new scripts alongside (do NOT replace):**
```powershell
mkdir C:\pookie-sync
# copy from the repo's sync-scripts/: pookie_sync\ dir, pookie-sync-windows.py,
# sync-config.json.example -> sync-config.json (fill child_slug etc.)
```

**2. Python deps + browsers** (the headless-shell lesson — both builds):
```powershell
pip install playwright keyring
python -m playwright install chromium chromium-headless-shell
```
If the scheduled task runs as SYSTEM, set `PLAYWRIGHT_BROWSERS_PATH` to a
shared path (e.g. `C:\playwright-browsers`) and install there as admin once —
the worker self-heals a missing build, but a shared path avoids per-user
reinstalls.

**3. Secrets:**
```powershell
# service_role key (pick ONE):
setx POKIE_SERVICE_ROLE_KEY "<key>"            # env var, new shells
# or: write C:\Users\<user>\.pookie\service-role.key and lock it down:
icacls .pookie\service-role.key /inheritance:r /grant:r "%USERNAME%:F"

# school password -> Windows Credential Manager:
cd C:\pookie-sync
python pookie-sync-windows.py --store-password --config sync-config.json
```

**4. Forced test sync (bypasses the queue):**
```powershell
python pookie-sync-windows.py --sync-now --config sync-config.json
```
Watch `C:\pookie-sync\sync.log`. Expect: `Sync attempt 1/10`, class count,
`Upsert result: {...counts...}`, `DONE: Sync complete`.

**5. Queue-path test (the real SYNC NOW flow):**
```powershell
python pookie-sync-windows.py --request-sync --config sync-config.json
python pookie-sync-windows.py --once --config sync-config.json
```
The second command should print `Worker (windows-laptop) picked up the sync`
and finish `complete`.

**6. Verify in Supabase** (service_role SQL or Table Editor):
```sql
SELECT id, slug FROM children WHERE slug = 'dawson-kamal';  -- copy the uuid
SELECT c.class_slug, g.term, g.numeric, g.synced_at
  FROM grades g JOIN classes c ON c.id = g.class_id
 WHERE g.child_id = '<uuid>' ORDER BY c.display_order;
SELECT count(*) FROM grade_snapshots WHERE child_id = '<uuid>'
  AND taken_at > now() - interval '1 hour';
SELECT count(*) FROM assignments WHERE child_id = '<uuid>';
SELECT title, due_date, status FROM due_next WHERE child_id = '<uuid>'
  ORDER BY due_date LIMIT 10;
SELECT subject FROM teacher_messages
 WHERE child_id = '<uuid>' AND direction = 'inbound'
 ORDER BY created_at DESC LIMIT 5;
SELECT status, created_at, completed_at, summary FROM sync_jobs
 WHERE child_id = '<uuid>' ORDER BY created_at DESC LIMIT 5;
SELECT device_name, status, last_heartbeat FROM sync_heartbeats;
```

**7. Schedule it** (Task Scheduler) — NEW task `Pookie Sync`, keep the old
Dawson task untouched:
- Trigger: daily (or the cadence Mehedi wants; old was manual `--once` runs)
- Action: `python C:\pookie-sync\pookie-sync-windows.py --once --config C:\pookie-sync\sync-config.json`
- Start in: `C:\pookie-sync`

**Rollback:** delete `C:\pookie-sync` and the new scheduled task. The old
script and its task were never touched.

---

## Machine 2 — MacBook

RustDesk ID `410072432` (no lock screen; FULL SCREEN on login; click **Allow**
on any macOS permission dialog) **or** Tailscale SSH to device "z"
(`100.98.245.117`, tunnel proxy port 3130, SSH_ASKPASS).

**0. Snapshot FIRST:**
```bash
cd ~/dawson-sync   # wherever the Mac worker lives
cp <worker>.py <worker>.py.WORKING-20261011
```

**1–3.** Same as Windows, with macOS paths:
```bash
mkdir -p ~/pookie-sync && cd ~/pookie-sync   # stage pookie_sync/, pookie-sync-mac.py, sync-config.json
pip3 install playwright keyring
python3 -m playwright install chromium chromium-headless-shell
mkdir -p ~/.pookie && chmod 700 ~/.pookie
# paste service_role key into ~/.pookie/service-role.key, then:
chmod 600 ~/.pookie/service-role.key
python3 pookie-sync-mac.py --store-password --config sync-config.json   # macOS Keychain
```

**4–6.** Same tests as Windows:
```bash
python3 pookie-sync-mac.py --sync-now --config sync-config.json
python3 pookie-sync-mac.py --request-sync --config sync-config.json
python3 pookie-sync-mac.py --once --config sync-config.json
# then run the section-6 SQL checks above
```

**7. Schedule it** (launchd, keeps the 3:05 AM auto-sync):
`~/Library/LaunchAgents/com.pookie.sync.plist` →
`/usr/bin/env python3 /Users/<user>/pookie-sync/pookie-sync-mac.py --auto --config /Users/<user>/pookie-sync/sync-config.json`,
`StartCalendarInterval` 3:05 AM. The `--auto` flag writes
`~/.pookie-sync-last-auto` so a missed schedule is visible in the log.
Do NOT disturb the old Mac worker's schedule — old and new claim from
different projects' queues, so they cannot double-claim.

**Rollback:** `launchctl unload` the plist, delete `~/pookie-sync`.

---

## Troubleshooting

- **403 on Supabase calls** → every request already sends a curl-style
  User-Agent (the urllib lesson); a 403 now means a wrong service_role key
  or the 009 RPCs not applied. Check `SELECT routine_name FROM
  information_schema.routines WHERE routine_schema='public'
  AND routine_name LIKE 'sync\_%';`
- **Chromium launch failure** → the worker self-installs
  `chromium` + `chromium-headless-shell` once and retries; if that fails,
  re-run step 2 manually and check disk space.
- **SSO 53003** → that machine is not passing Conditional Access; on the
  Windows laptop this should not happen (it is the approved device).
- **"Unknown child_slug"** → create the child in the app first; the worker
  never invents tenants.
- **Empty sweep but login worked** → check `sync-debug.html` in the log dir;
  the parser-degradation alert fires in the job log if <10 assignments
  across 6 classes.
