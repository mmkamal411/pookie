"""Pookie school-portal sync pipeline.

Multi-tenant StudentVUE/Office365 sync worker. One canonical package,
two thin platform entry points (``pookie-sync-windows.py``,
``pookie-sync-mac.py``).

Pipeline: claim (sync_jobs queue) -> sweep (portal adapters) ->
upsert (atomic ``sync_upsert_sweep`` RPC on the pookie project) ->
finish. Idempotent and re-runnable; every write carries ``child_id``
resolved from config, never hardcoded.
"""
