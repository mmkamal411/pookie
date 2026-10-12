#!/usr/bin/env bash
# placeholder-audit.sh — TEST-PLAN §1 Placeholder Audit (MD directive 2026-10-12: NO PLACEHOLDERS).
# Any failure = work package is NOT done, regardless of UI appearance.
# Usage: ./placeholder-audit.sh [scope-dir]   (default: src)
# Exit 0 = PASS, exit 1 = FAIL with the failing checks listed.
set -u
REPO="${REPO:-$HOME/workspace/pookie-app}"
SCOPE="${1:-src}"
cd "$REPO" || { echo "FAIL: cannot cd to $REPO"; exit 1; }

FAIL=0
hit() { # $1=label $2=count
  if [ "$2" -gt 0 ]; then echo "  ❌ $1 ($2 hits)"; FAIL=1; else echo "  ✅ $1"; fi
}

echo "== P1: mock/fixture/sampleData/dummy in shipped code paths =="
P1=$(grep -rniE "mock|fixture|sampleData|dummy" "$SCOPE" supabase/migrations 2>/dev/null \
  | grep -viE "\.test\.|\.spec\.|\.stories\." \
  | grep -vE "^\S+:[0-9]+:\s*(//|--|/\*|#)" \
  | grep -viE "no mocks?|no fixtures?|no stubs?|never with mock|no silent|no mock data" \
  | grep -vE "node_modules" | wc -l)
hit "P1 no mock/fixture data" "$P1"

echo "== P2: stubbed functions =="
P2=$(grep -rniE "not implemented|TODO implement|return null // TODO|// stub" "$SCOPE" 2>/dev/null \
  | grep -viE "not implemented in v1|is not implemented here" \
  | grep -v node_modules | wc -l)
hit "P2 no stubs" "$P2"

echo "== P3: TODO/FIXME/XXX/HACK comments =="
P3=$(grep -rnE "TODO|FIXME|\bXXX\b|\bHACK\b" "$SCOPE" supabase/migrations 2>/dev/null \
  | grep -viE "no (mocks?|stubs?|TODOs?)" \
  | grep -v node_modules | wc -l)
hit "P3 no TODO/FIXME" "$P3"

echo "== P4: 'coming soon' / dead-end UI (HTML placeholder= attrs excluded) =="
P4=$(grep -rniE "coming soon|under construction|coming-soon|soon™" "$SCOPE" 2>/dev/null \
  | grep -viE "placeholder=|aria-|never |never a dead|never \"coming" | grep -v node_modules | wc -l)
hit "P4 no 'coming soon' UI" "$P4"

echo "== P5: API calls against non-real endpoints =="
P5=$(grep -rniE "fetch\(['\"]https?://localhost|axios\.get\(['\"]https?://localhost|/mock/|fake-api" "$SCOPE" 2>/dev/null \
  | grep -viE "\.test\.|\.spec\.|comment" | grep -v node_modules | wc -l)
hit "P5 every API call hits a real endpoint" "$P5"

echo "== P6 (static half): console.log scan (Mehedi cleanliness rule) =="
P6=$(grep -rn "console\.log" "$SCOPE" 2>/dev/null | grep -v node_modules | wc -l)
hit "P6 no console.logs" "$P6"

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "PLACEHOLDER AUDIT: PASS — package may be marked done (pending §10.2 RLS-with-real-JWTs on staging)."
else
  echo "PLACEHOLDER AUDIT: FAIL — package is NOT done. Fix the hits above."
  echo "NOTE: P6's dynamic half (RLS enforced with real JWTs, not service_role) runs on staging only — see TEST-PLAN §10.1."
fi
exit "$FAIL"
