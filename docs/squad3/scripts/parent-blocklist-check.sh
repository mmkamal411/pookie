#!/usr/bin/env bash
# parent-blocklist-check.sh — TEST-PLAN B-SER-01: CI-style sampling of parent-visible
# API payloads for blocklisted fields. Per sol-school-ai.md §5.3 the parent serializer
# must never emit: calibration_scores.*, checkin_estimates.*, checkins.text/body beyond scope.
# Env: STAGING_URL, PARENT_JWT, CHILD_ID, ANON_KEY
# Exit 0 = no blocklisted fields found; exit 1 = leak detected.
set -u
: "${STAGING_URL:?set STAGING_URL}" ; : "${PARENT_JWT:?set PARENT_JWT}" ; : "${CHILD_ID:?set CHILD_ID}" ; : "${ANON_KEY:?set ANON_KEY}"

BLOCKLIST='calibration_scores|checkin_estimates|checkin_estimates"|"body"|"text"'
# NOTE: "text"/"body" are only blocklisted when they carry check-in content. The
# sampler flags candidates; the allowlist below removes known-safe keys (e.g.
# teacher-message body is parent-visible by scope; study-plan action text is teen's
# own checkbox content). Every candidate not allowlisted must be reviewed.
ALLOWLIST='subject|teacher_messages|plan'

FAIL=0
sample() { # $1=label $2=path
  out=$(curl -s "$STAGING_URL$2" -H "Authorization: Bearer $PARENT_JWT" -H "apikey: $ANON_KEY")
  hits=$(echo "$out" | grep -oiE "$BLOCKLIST" | grep -viE "$ALLOWLIST" | sort -u | tr '\n' ' ')
  if [ -z "$hits" ]; then echo "  ✅ $1 — clean"
  else echo "  ❌ $1 — blocklisted fields: $hits"; FAIL=1; fi
}

echo "== B-SER-01: parent-visible payload blocklist sampling =="
sample "school/overview"      "/api/v1/children/$CHILD_ID/school/overview"
sample "school/classes"       "/api/v1/children/$CHILD_ID/school/classes"
sample "teacher-messages"     "/api/v1/children/$CHILD_ID/school/teacher-messages"
sample "due-next"             "/api/v1/children/$CHILD_ID/school/due-next"
sample "briefings/latest"     "/api/v1/children/$CHILD_ID/briefings/latest"

echo ""
if [ "$FAIL" -eq 0 ]; then echo "BLOCKLIST SAMPLING: PASS"; else echo "BLOCKLIST SAMPLING: FAIL — parent-visible leak"; fi
exit "$FAIL"
