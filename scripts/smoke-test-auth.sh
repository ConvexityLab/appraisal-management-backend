#!/usr/bin/env bash
# scripts/smoke-test-auth.sh
#
# Smoke-test that authentication enforcement is working correctly.
# Asserts that every protected endpoint returns 401 when called without a token,
# and that public health endpoints return 200.
#
# Usage:
#   bash scripts/smoke-test-auth.sh <BASE_URL> [--skip-ready]
#
# Arguments:
#   BASE_URL     e.g. http://localhost:3000 or https://my-app.azurecontainerapps.io
#   --skip-ready Skip the /ready check (useful when no DB is available, e.g. CI pre-deploy)
#
# Exit code: 0 = all pass, 1 = one or more assertions failed.

set -euo pipefail

BASE_URL="${1:?ERROR: BASE_URL is required. Usage: smoke-test-auth.sh <BASE_URL> [--skip-ready]}"
SKIP_READY="${2:-}"

FAILED=0
PASSED=0

expect_status() {
  local desc="$1"
  local expected="$2"
  local url="$3"
  shift 3

  local actual
  actual=$(curl -s -o /dev/null -w "%{http_code}" \
    --connect-timeout 5 \
    --max-time 15 \
    "$@" \
    "$url" 2>/dev/null || echo "000")

  if [[ "$actual" == "$expected" ]]; then
    echo "  PASS [$actual] $desc"
    PASSED=$((PASSED + 1))
  else
    echo "  FAIL $desc — expected HTTP $expected, got $actual"
    FAILED=$((FAILED + 1))
  fi
}

echo "========================================================"
echo " Auth smoke tests against: $BASE_URL"
echo "========================================================"

# ── Public endpoints ────────────────────────────────────────
echo ""
echo "[Public endpoints — expect 200]"
expect_status "GET /health" "200" "$BASE_URL/health"
if [[ "$SKIP_READY" != "--skip-ready" ]]; then
  expect_status "GET /ready"  "200" "$BASE_URL/ready"
fi

# ── Protected endpoints (no token) — expect 401 ─────────────
echo ""
echo "[Protected endpoints, no token — expect 401]"
expect_status "GET /api/orders"                          "401" "$BASE_URL/api/orders"
expect_status "GET /api/vendors"                         "401" "$BASE_URL/api/vendors"
expect_status "GET /api/documents"                       "401" "$BASE_URL/api/documents"
expect_status "GET /api/appraisers"                      "401" "$BASE_URL/api/appraisers"
expect_status "GET /api/inspections"                     "401" "$BASE_URL/api/inspections"
expect_status "GET /api/clients"                         "401" "$BASE_URL/api/clients"
expect_status "GET /api/negotiations"                    "401" "$BASE_URL/api/negotiations"
expect_status "GET /api/engagements"                     "401" "$BASE_URL/api/engagements"
expect_status "GET /api/qc-workflow/queue"               "401" "$BASE_URL/api/qc-workflow/queue"
expect_status "GET /api/qc-rules"                        "401" "$BASE_URL/api/qc-rules"
expect_status "GET /api/construction/draw-inspections"   "401" "$BASE_URL/api/construction/draw-inspections"
expect_status "GET /api/construction/inspections"        "401" "$BASE_URL/api/construction/inspections"

# ── Garbage token — must still be rejected ──────────────────
echo ""
echo "[Malformed Authorization header — expect 401]"
expect_status "GET /api/orders (garbage token)" "401" \
  "$BASE_URL/api/orders" \
  -H "Authorization: Bearer not-a-real-jwt"
expect_status "GET /api/vendors (garbage token)" "401" \
  "$BASE_URL/api/vendors" \
  -H "Authorization: Bearer not-a-real-jwt"

# ── Summary ─────────────────────────────────────────────────
echo ""
echo "========================================================"
TOTAL=$((PASSED + FAILED))
if [[ $FAILED -gt 0 ]]; then
  echo " FAILED: $FAILED/$TOTAL assertions failed (see above)"
  echo "========================================================"
  exit 1
fi
echo " PASSED: $TOTAL/$TOTAL assertions passed"
echo "========================================================"
exit 0
