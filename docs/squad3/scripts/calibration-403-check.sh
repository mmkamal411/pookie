#!/usr/bin/env bash
# calibration-403-check.sh — TEST-PLAN C-SEC-01: automated assertions that a
# parent-scoped JWT gets 403/empty on EVERY calibration endpoint.
# Run when the calibration endpoints land (sol-school-ai.md §5). Staging only.
# Env: STAGING_URL (https://…pages.dev), PARENT_JWT (Parent A JWT), CHILD_ID (uuid)
# Exit 0 = all assertions hold; exit 1 = any calibration data leaks to a parent.
set -u
: "${STAGING_URL:?set STAGING_URL}" ; : "${PARENT_JWT:?set PARENT_JWT}" ; : "${CHILD_ID:?set CHILD_ID}"

FAIL=0
assert_blocked() { # $1=label $2=url $3=method
  code=$(curl -s -o /tmp/cal403.out -w "%{http_code}" -X "${3:-GET}" "$2" \
    -H "Authorization: Bearer $PARENT_JWT" -H "apikey: ${ANON_KEY:?set ANON_KEY}")
  body=$(cat /tmp/cal403.out)
  if [ "$code" = "403" ]; then
    echo "  ✅ $1 → 403"
  elif [ "$code" = "200" ] && { [ "$body" = "[]" ] || [ "$body" = "{}" ] || [ -z "$body" ]; }; then
    echo "  ✅ $1 → 200 empty"
  else
    echo "  ❌ $1 → HTTP $code — LEAK: ${body:0:200}"; FAIL=1
  fi
}

echo "== C-SEC-01: parent-scoped JWT on calibration endpoints =="
assert_blocked "GET calibration_scores"            "$STAGING_URL/api/v1/children/$CHILD_ID/school/calibration"
assert_blocked "GET checkin_estimates"             "$STAGING_URL/api/v1/children/$CHILD_ID/school/checkins/estimates"
assert_blocked "POST checkin_estimate (parent)"    "$STAGING_URL/api/v1/children/$CHILD_ID/school/checkins/estimates" POST
assert_blocked "GET checkin history (parent)"      "$STAGING_URL/api/v1/children/$CHILD_ID/school/checkins"
assert_blocked "GET parent briefing digest"        "$STAGING_URL/api/v1/children/$CHILD_ID/briefings/latest"

echo ""
if [ "$FAIL" -eq 0 ]; then echo "CALIBRATION 403 CHECK: PASS"; else echo "CALIBRATION 403 CHECK: FAIL — parent-visible leak"; fi
exit "$FAIL"
