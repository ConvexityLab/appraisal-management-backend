#!/usr/bin/env bash
# deploy-infra.sh — Local convenience wrapper for az deployment sub create.
#
# Usage:
#   ./scripts/deploy-infra.sh dev
#   ./scripts/deploy-infra.sh staging
#   ./scripts/deploy-infra.sh prod
#
# Prerequisites:
#   az login (or set AZURE_CREDENTIALS / AZURE_SUBSCRIPTION_ID in env)
#   az account set --subscription <AZURE_SUBSCRIPTION_ID>
#
# Required env vars (all optional — fall back to parameter file defaults or
# skip the integration):
#   AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET
#   AXIOM_WEBHOOK_SECRET, MOP_SERVICE_AUTH_TOKEN, AIM_PORT_API_KEY
#   BATCHDATA_KEY, GOOGLE_MAPS_API_KEY, AZURE_OPENAI_API_KEY
#   AZURE_OPENAI_ENDPOINT, GOOGLE_GEMINI_API_KEY, SAMBANOVA_API_KEY
#
# This script performs the same steps as the infrastructure.yml GitHub Actions
# workflow, but runs locally. Useful for immediate infra-only changes (e.g.
# activating Service Bus diagnostic settings) without waiting for a CI run.

set -euo pipefail

ENVIRONMENT="${1:-}"
if [[ -z "$ENVIRONMENT" ]]; then
  echo "❌ Usage: $0 <dev|staging|prod>" >&2
  exit 1
fi

if [[ "$ENVIRONMENT" != "dev" && "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "prod" ]]; then
  echo "❌ Environment must be dev, staging, or prod. Got: $ENVIRONMENT" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PARAM_FILE="$REPO_ROOT/infrastructure/parameters/$ENVIRONMENT.parameters.json"
DEPLOYMENT_NAME="main-local-$(date +%Y%m%d%H%M%S)"

echo "🔍 Deploying infrastructure to environment: $ENVIRONMENT"
echo "   Parameter file : $PARAM_FILE"
echo "   Deployment name: $DEPLOYMENT_NAME"
echo ""

if [[ ! -f "$PARAM_FILE" ]]; then
  echo "❌ Parameter file not found: $PARAM_FILE" >&2
  exit 1
fi

# Build parameter args array — only pass secrets that are present in env.
PARAM_ARGS=(
  --parameters "@${PARAM_FILE}"
)

[ -n "${BATCHDATA_KEY:-}"              ] && PARAM_ARGS+=("batchDataApiKey=${BATCHDATA_KEY}")
[ -n "${GOOGLE_MAPS_API_KEY:-}"        ] && PARAM_ARGS+=("googleMapsApiKey=${GOOGLE_MAPS_API_KEY}")
[ -n "${AZURE_OPENAI_API_KEY:-}"       ] && PARAM_ARGS+=("azureOpenAiApiKey=${AZURE_OPENAI_API_KEY}")
[ -n "${AZURE_OPENAI_ENDPOINT:-}"      ] && PARAM_ARGS+=("azureOpenAiEndpoint=${AZURE_OPENAI_ENDPOINT}")
[ -n "${GOOGLE_GEMINI_API_KEY:-}"      ] && PARAM_ARGS+=("googleGeminiApiKey=${GOOGLE_GEMINI_API_KEY}")
[ -n "${SAMBANOVA_API_KEY:-}"          ] && PARAM_ARGS+=("sambanovaApiKey=${SAMBANOVA_API_KEY}")
[ -n "${AZURE_TENANT_ID:-}"            ] && PARAM_ARGS+=("azureTenantId=${AZURE_TENANT_ID}")
[ -n "${AZURE_CLIENT_ID:-}"            ] && PARAM_ARGS+=("azureClientId=${AZURE_CLIENT_ID}")
[ -n "${AZURE_CLIENT_SECRET:-}"        ] && PARAM_ARGS+=("azureClientSecret=${AZURE_CLIENT_SECRET}")
[ -n "${AXIOM_WEBHOOK_SECRET:-}"       ] && PARAM_ARGS+=("axiomWebhookSecret=${AXIOM_WEBHOOK_SECRET}")
[ -n "${MOP_SERVICE_AUTH_TOKEN:-}"     ] && PARAM_ARGS+=("mopServiceAuthToken=${MOP_SERVICE_AUTH_TOKEN}")
[ -n "${AIM_PORT_API_KEY:-}"           ] && PARAM_ARGS+=("aimPortApiKey=${AIM_PORT_API_KEY}")

# Resolve SP object ID from client ID (non-secret, needed by entra module).
if [[ -n "${AZURE_CLIENT_ID:-}" ]]; then
  SP_OID=$(az ad sp show --id "${AZURE_CLIENT_ID}" --query id -o tsv 2>/dev/null || true)
  if [[ -n "$SP_OID" ]]; then
    echo "✅ Resolved SP object ID: $SP_OID"
    PARAM_ARGS+=("azureServicePrincipalObjectId=${SP_OID}")
    PARAM_ARGS+=("ciServicePrincipalId=${SP_OID}")
  else
    echo "⚠️  Could not resolve SP object ID — entra-extension-attributes module will be skipped."
  fi
fi

# Read location from the parameter file (default eastus).
LOCATION=$(python3 -c "import json,sys; d=json.load(open('$PARAM_FILE')); print(d['parameters'].get('location',{}).get('value','eastus'))" 2>/dev/null || echo "eastus")

echo ""
echo "▶  Validating Bicep template..."
az deployment sub validate \
  --name "${DEPLOYMENT_NAME}-validate" \
  --location "$LOCATION" \
  --template-file "$REPO_ROOT/infrastructure/main.bicep" \
  "${PARAM_ARGS[@]}" \
  --output none

echo "✅ Validation passed."
echo ""
echo "▶  Deploying (this takes ~3-8 minutes)..."

az deployment sub create \
  --name "$DEPLOYMENT_NAME" \
  --location "$LOCATION" \
  --template-file "$REPO_ROOT/infrastructure/main.bicep" \
  "${PARAM_ARGS[@]}" \
  --query 'properties.outputs' \
  --output json

echo ""
echo "✅ Infrastructure deployment complete."
echo ""
echo "What's now live:"
echo "  • Service Bus → Log Analytics diagnostic settings (OperationalLogs, RuntimeAuditLogs, AllMetrics)"
echo "  • LOG_ANALYTICS_WORKSPACE_ID env var on the appraisal-api Container App"
echo "  • App Insights custom events for vendor pipeline hops will flow to Log Analytics"
echo "    customEvents table as soon as the Container App processes its next vendor event."
