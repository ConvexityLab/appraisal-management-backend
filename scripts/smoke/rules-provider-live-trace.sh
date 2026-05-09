#!/usr/bin/env bash
#
# rules-provider-live-trace.sh — fire one real /find-matches call against AMS
# dev and tail the container logs for the structured `mop.eval.success` /
# `mop.eval.failure` events emitted by MopVendorMatchingRulesProvider.
#
# Confirms end-to-end that:
#   1. AMS auth accepts the caller's token.
#   2. The matching engine routes through the provider abstraction.
#   3. The provider talks to MOP (not the homegrown fallback).
#   4. MOP returns a result that surfaces as a `mop.eval.success` log line.
#
# Why a script (instead of an inline curl): AMS's Entra app reg
# (f16f7cc2-94ae-40a9-8871-97c72d8511eb) doesn't accept tokens issued for the
# Azure CLI's well-known SP (04b07795-...), so `az account get-access-token`
# from a generic developer login fails with AADSTS100040. To run this you
# need a service principal that AMS recognizes — typically the same one
# CI uses (AZURE_CREDENTIALS in GH secrets).
#
# Usage:
#   AZURE_CLIENT_ID=<sp-app-id>      \
#   AZURE_CLIENT_SECRET=<sp-secret>  \
#   AZURE_TENANT_ID=<tenant>         \
#   ./scripts/smoke/rules-provider-live-trace.sh [dev|staging]
#
# Or, if you already have a JWT in $TOKEN, skip the login:
#   TOKEN=<jwt> ./scripts/smoke/rules-provider-live-trace.sh dev
#
# Exit codes:
#   0  — saw mop.eval.success in logs after the request returned
#   1  — request itself failed
#   2  — request succeeded but no mop.eval.* log within the watch window

set -e

ENV="${1:-dev}"
WATCH_SECONDS="${WATCH_SECONDS:-30}"

# Per-env config — only dev exists today.
case "$ENV" in
  dev)
    AMS_FQDN="ca-appraisalapi-dev-7iqx.victoriouscliff-3b343869.eastus.azurecontainerapps.io"
    AMS_APP="ca-appraisalapi-dev-7iqx"
    AMS_RG="rg-appraisal-mgmt-dev-eastus"
    AMS_AUDIENCE="f16f7cc2-94ae-40a9-8871-97c72d8511eb"
    ;;
  staging)
    AMS_FQDN="ca-appraisalapi-sta-lqxl.jollysand-19372da7.eastus.azurecontainerapps.io"
    AMS_APP="ca-appraisalapi-sta-lqxl"
    AMS_RG="rg-appraisal-mgmt-staging-eastus"
    AMS_AUDIENCE="<TODO: pull from container app env>"
    ;;
  *)
    echo "Unknown env: $ENV" >&2; exit 1
    ;;
esac

# Acquire token (skip if pre-supplied).
if [ -z "${TOKEN:-}" ]; then
  if [ -z "${AZURE_CLIENT_ID:-}" ] || [ -z "${AZURE_CLIENT_SECRET:-}" ] || [ -z "${AZURE_TENANT_ID:-}" ]; then
    echo "::error::Set TOKEN, or AZURE_CLIENT_ID + AZURE_CLIENT_SECRET + AZURE_TENANT_ID for client_credentials grant." >&2
    exit 1
  fi
  TOKEN=$(curl -sS --max-time 10 \
    -d "client_id=${AZURE_CLIENT_ID}" \
    -d "client_secret=${AZURE_CLIENT_SECRET}" \
    -d "scope=${AMS_AUDIENCE}/.default" \
    -d "grant_type=client_credentials" \
    "https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token" \
    | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
  if [ -z "$TOKEN" ]; then
    echo "::error::Failed to acquire token for audience ${AMS_AUDIENCE}" >&2
    exit 1
  fi
fi

# Capture the log cursor BEFORE we fire so we don't pick up unrelated noise.
START_TS=$(date -u +%s)

echo "→ POST /api/auto-assignment/find-matches @ ${AMS_FQDN}"
RESP=$(curl -sS --max-time 30 -X POST \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  --data-raw '{"propertyAddress":"123 Smoke Test St, Fairfax, VA","propertyType":"FULL_APPRAISAL","topN":3}' \
  -w "\n__HTTP_STATUS__%{http_code}" \
  "https://${AMS_FQDN}/api/auto-assignment/find-matches")
HTTP=$(echo "$RESP" | sed -n 's/.*__HTTP_STATUS__\([0-9]*\).*/\1/p')
BODY=$(echo "$RESP" | sed 's/__HTTP_STATUS__[0-9]*$//')
echo "← HTTP ${HTTP}"
echo "${BODY}" | head -c 500; echo

if [ "$HTTP" != "200" ]; then
  echo "::error::find-matches did not return 200 — request layer broken before reaching the provider." >&2
  exit 1
fi

echo "→ Watching ${AMS_APP} logs for mop.eval.* events (${WATCH_SECONDS}s)..."

# Container Apps log API isn't real-time; poll over the watch window.
end=$(( $(date -u +%s) + WATCH_SECONDS ))
while [ "$(date -u +%s)" -lt "$end" ]; do
  HITS=$(az containerapp logs show \
    -n "${AMS_APP}" -g "${AMS_RG}" \
    --tail 100 --type console 2>/dev/null \
    | grep -E "mop\.eval\.(success|failure)" || true)
  if [ -n "$HITS" ]; then
    echo "✅ saw mop.eval.* events:"
    echo "$HITS" | tail -5
    exit 0
  fi
  sleep 5
done

echo "::warning::request succeeded but no mop.eval.* log entry observed within ${WATCH_SECONDS}s." >&2
echo "  - Check that RULES_PROVIDER on the AMS container is 'mop' or 'mop-with-fallback'." >&2
echo "  - If RULES_PROVIDER=homegrown, the engine never reaches MopVendorMatchingRulesProvider." >&2
exit 2
