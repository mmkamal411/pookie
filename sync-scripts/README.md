# Pookie school-portal sync scripts

Multi-tenant StudentVUE + Office 365 sync workers for the Pookie platform.
**One canonical package, two thin platform entry points** — no divergent forks.

```
sync-scripts/
├── pookie_sync/                 # the canonical package (both platforms)
│   ├── config.py                # sync-config.json + env (no secrets on disk)
│   ├── credentials.py           # OS keychain -> Pookie vault; service_role via env/0600 file
│   ├── transport.py             # urllib + curl-style User-Agent (the 403 lesson)
│   ├── supabase.py              # service_role REST client; slug -> child_id; class matching
│   ├── queue.py                 # claim -> finish -> append_log -> heartbeat (009 RPCs)
│   ├── pipeline.py              # do_sync(): claim -> sweep -> upsert -> finish
│   ├── main.py                  # CLI: --once / --sync-now / --request-sync / --store-password
│   └── adapters/
│       └── cobb.py              # StudentVUE + Office 365 sweeps (ported from the
│                                #   working 2026-10-10 script, all parser fixes kept)
├── pookie-sync-windows.py       # Windows wrapper (UA + platform env)
├── pookie-sync-mac.py           # Mac wrapper (--auto flag for the 3:05 AM launchd tick)
├── sync-config.json.example     # copy to sync-config.json; NO secrets in it
├── tests/
│   ├── test_pipeline.py         # dry-run E2E (mocked adapter + schema-faithful fake backend)
│   └── fixtures/sweep_sample.json
└── INSTALL-RUNBOOK.md           # per-machine install + test steps
```

## Data flow (E2E)

```
portal (StudentVUE / Office 365)
  -> adapters/cobb.py            sweep -> plain dicts (grades, class_details,
                                 synergy_mail, o365 emails)
  -> pipeline.build_sweep_payload  map to the 006 schema; resolve class_slug
                                 against the classes table (slug/alias match)
  -> sync_upsert_sweep RPC       ATOMIC, service_role-only (009):
       classes            resolve-or-create by (child_id, class_slug)
       grades             upsert on (child_id, class_id, term)
       grade_snapshots    append one row per class per sync (drop-trigger feed)
       assignments        upsert on (child_id, class_id, source_id)
       teacher_messages   inbound insert, deduped on (thread_key, sent_at)
  -> sync_finish_job             complete / failed + summary
app reads: grades (current) · due_next (view) · grade_snapshots (trend) ·
           teacher_messages (inbox) · sync_jobs (history) · sync_heartbeats
```

Every write carries `child_id`, resolved once per run from
`child_slug` in config — nothing is hardcoded.

## Queue pattern

Same as the old project, child-scoped: `sync_request_job` (SYNC NOW) ->
`sync_claim_job` (`FOR UPDATE SKIP LOCKED`, oldest pending first) ->
sweep -> `sync_upsert_sweep` -> `sync_finish_job`. Heartbeats go to
`sync_heartbeats`; per-run lines to the job's `log` via `sync_append_log`.
RPC names follow the new project's plain-name convention (not the old
`rpc_` prefix). All are `SECURITY DEFINER` + `service_role`-only.

## Tenancy & secrets

- Service_role is the pipeline's write identity (006 gives the sync tables
  no client write policies — service_role bypasses RLS by design).
- School password: OS keychain (`pookie-sync` service) first, Pookie vault
  `get_tenant_secret` second, never in config or code. Injected into the
  adapter transiently (memory only) for the SSO form.
- A failed/empty sync never writes partial data: the upsert is one RPC.

## Coexistence with the old scripts

The old `dawson-windows-sync.py` (old project `qtzvunuqbnikvgttidco`,
tables `studentvue_syncs`/`sync_requests`/`daily_content`) is untouched by
this redesign and keeps running until the founder calls cutover. The new
scripts target only the pookie project (`fspvcuaupkdsekpwmnep`).

## Status

- [x] Package + adapters ported; dry-run E2E green (6 tests)
- [x] `009_sync_queue.sql` authored (syntax-checked; **not yet applied**)
- [ ] 009 applied to the pookie project (DBA)
- [ ] Windows laptop install + test sync (runbook ready)
- [ ] MacBook install + test sync (runbook ready)
