#!/usr/bin/env bash
# verify-asset-version.sh — post-deploy guard for the ?v= cache-busting lesson.
#
# Usage: bash scripts/verify-asset-version.sh https://pookie-staging.pages.dev
#
# Fetches the deployed homepage and asserts that every ?v= asset version on the
# page is IDENTICAL (exactly one unique version). Mixed versions mean the deploy
# shipped mismatched assets (new HTML, stale JS) — the failure mode that burned
# us on d-dash (see AGENTS.md "Deploy versioning").
#
# Exit 0: exactly one version found. Exit 1: mixed versions (FAIL the deploy).
# Warn (exit 0): no ?v= params found — frontend has not implemented versioning yet.

set -u

URL="${1:?usage: verify-asset-version.sh <deployed-url>}"
ATTEMPTS=12
SLEEP_SECS=10

echo "Checking asset versions on ${URL} ..."

HTML=""
for i in $(seq 1 "$ATTEMPTS"); do
  HTML="$(curl -sL --max-time 30 "$URL" || true)"
  if [ -n "$HTML" ]; then
    break
  fi
  echo "  attempt $i: empty response, retrying in ${SLEEP_SECS}s ..."
  sleep "$SLEEP_SECS"
done

if [ -z "$HTML" ]; then
  echo "ERROR: no response from ${URL} after ${ATTEMPTS} attempts"
  exit 1
fi

VERSIONS="$(printf '%s' "$HTML" | grep -o '?v=[0-9A-Za-z._-]*' | sort -u || true)"
COUNT="$(printf '%s' "$VERSIONS" | grep -c . || true)"

if [ "$COUNT" -eq 0 ]; then
  echo "WARN: no ?v= versioned assets found on ${URL}."
  echo "The frontend has not implemented ?v= cache-busting yet (see docs/ENV-MANAGEMENT.md)."
  echo "This is a warning, not a failure — implement versioning before production traffic."
  exit 0
fi

if [ "$COUNT" -eq 1 ]; then
  echo "OK: single asset version deployed: $(printf '%s' "$VERSIONS" | head -1)"
  exit 0
fi

echo "ERROR: MIXED asset versions detected on ${URL} ($COUNT unique):"
printf '%s\n' "$VERSIONS"
echo "The deploy shipped mismatched assets. Roll back and re-deploy with a single version."
exit 1
