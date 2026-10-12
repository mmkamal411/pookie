#!/usr/bin/env bash
# Migration idempotency CI check (heuristic).
#
# Every .sql in this directory must be re-runnable without error:
#   - CREATE TABLE           -> must say IF NOT EXISTS
#   - CREATE POLICY          -> must be preceded (<=3 lines above) by DROP POLICY IF EXISTS
#                              (Postgres has no CREATE POLICY IF NOT EXISTS)
#   - CREATE TRIGGER         -> must be preceded (<=3 lines above) by DROP TRIGGER IF EXISTS
#                              (Postgres has no IF NOT EXISTS / OR REPLACE for triggers)
#   - CREATE FUNCTION        -> must say OR REPLACE
#
# Fails (exit 1) with a list of violations. Keep the rules simple and obvious.
set -u

DIR="$(cd "$(dirname "$0")" && pwd)"
fail=0
report() { echo "FAIL: $1"; fail=1; }

for f in "$DIR"/*.sql; do
  base="$(basename "$f")"

  # 1) CREATE TABLE without IF NOT EXISTS
  while IFS= read -r line; do
    report "$base: $line"
  done < <(grep -nE '^[[:space:]]*CREATE[[:space:]]+TABLE[[:space:]]' "$f" \
           | grep -vi 'IF NOT EXISTS' || true)

  # 2) CREATE POLICY not preceded by DROP POLICY IF EXISTS
  while IFS= read -r ln; do
    start=$((ln - 3)); [ "$start" -lt 1 ] && start=1
    if ! sed -n "${start},$((ln - 1))p" "$f" | grep -q 'DROP POLICY IF EXISTS'; then
      report "$base:$ln: CREATE POLICY not preceded by DROP POLICY IF EXISTS"
    fi
  done < <(grep -nE '^[[:space:]]*CREATE[[:space:]]+POLICY[[:space:]]' "$f" | cut -d: -f1)

  # 3) CREATE TRIGGER not preceded by DROP TRIGGER IF EXISTS
  while IFS= read -r ln; do
    start=$((ln - 3)); [ "$start" -lt 1 ] && start=1
    if ! sed -n "${start},$((ln - 1))p" "$f" | grep -q 'DROP TRIGGER IF EXISTS'; then
      report "$base:$ln: CREATE TRIGGER not preceded by DROP TRIGGER IF EXISTS"
    fi
  done < <(grep -nE '^[[:space:]]*CREATE[[:space:]]+TRIGGER[[:space:]]' "$f" | cut -d: -f1)

  # 4) CREATE FUNCTION without OR REPLACE
  while IFS= read -r line; do
    report "$base: $line"
  done < <(grep -nE '^[[:space:]]*CREATE[[:space:]]+FUNCTION[[:space:]]' "$f" \
           | grep -vi 'OR REPLACE' || true)
done

if [ "$fail" -eq 0 ]; then
  echo "PASS: all migrations have idempotency guards (heuristic)"
fi
exit "$fail"
