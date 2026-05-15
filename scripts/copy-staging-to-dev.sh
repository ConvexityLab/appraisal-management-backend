#!/usr/bin/env bash
# copy-staging-to-dev.sh
#
# Copy all Cosmos DB containers from appraisal-mgmt-staging-cosmos
# to appraisal-mgmt-dev-cosmos using Azure's server-side copy jobs.
#
# Auth: az login — no keys stored; uses your Azure CLI identity.
#
# Prerequisites (one-time setup):
#   1. az extension add --name cosmosdb-preview
#   2. Your identity needs:
#        Cosmos DB Account Reader Role  on appraisal-mgmt-staging-cosmos
#        Contributor                    on appraisal-mgmt-dev-cosmos
#   3. Grant the dev account's managed identity read access to staging:
#        DEST_PRINCIPAL=$(az cosmosdb show --name appraisal-mgmt-dev-cosmos \
#          --resource-group rg-appraisal-mgmt-dev-eastus \
#          --query "identity.principalId" -o tsv)
#        SRC_SCOPE=$(az cosmosdb show --name appraisal-mgmt-staging-cosmos \
#          --resource-group rg-appraisal-mgmt-staging-eastus \
#          --query id -o tsv)
#        az role assignment create --assignee "$DEST_PRINCIPAL" \
#          --role "Cosmos DB Account Reader Role" --scope "$SRC_SCOPE"
#   4. All destination containers must already exist in dev (run: pnpm seed)
#
# Usage:
#   bash scripts/copy-staging-to-dev.sh                  # copy all containers
#   bash scripts/copy-staging-to-dev.sh --dry-run        # preview only
#   bash scripts/copy-staging-to-dev.sh --container=orders  # single container
#   bash scripts/copy-staging-to-dev.sh --skip-wait      # fire-and-forget
#
# To verify exact container names in staging before running:
#   az cosmosdb sql container list \
#     --account-name appraisal-mgmt-staging-cosmos \
#     --database-name appraisal-management \
#     --resource-group rg-appraisal-mgmt-staging-eastus \
#     --query "[].name" -o tsv

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
SRC_ACCOUNT="appraisal-mgmt-staging-cosmos"
SRC_RG="rg-appraisal-mgmt-staging-eastus"

DEST_ACCOUNT="appraisal-mgmt-dev-cosmos"
DEST_RG="rg-appraisal-mgmt-dev-eastus"

DATABASE="appraisal-management"
JOB_PREFIX="stg-to-dev-$(date +%Y%m%d%H%M)"
POLL_INTERVAL_SECONDS=15

# All known containers (application + Axiom/BPO seed containers).
# Adjust this list if staging has extra or differently-named containers.
ALL_CONTAINERS=(
  orders
  vendors
  clients
  products
  documents
  qc-checklists
  qc-reviews
  assignments
  communications
  construction
  bulk-portfolio-jobs
  matching-criteria
  timeline
  review-programs
  pdf-templates
  escalations
  revisions
  sla-config
  properties
  engagements
  inspections
  reports
  arv-analyses
  communication-platform
  construction-catalog
  report-templates
  audit-events
  quickbooks
  DocumentTypeRegistry
  DocumentSchemas
)

# ── Parse flags ───────────────────────────────────────────────────────────────
DRY_RUN=false
SKIP_WAIT=false
CONTAINER_FILTER=""

for arg in "$@"; do
  case "$arg" in
    --dry-run)         DRY_RUN=true ;;
    --skip-wait)       SKIP_WAIT=true ;;
    --container=*)     CONTAINER_FILTER="${arg#*=}" ;;
    -h|--help)
      sed -n '/^#/p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "ERROR: Unknown flag: $arg" >&2
      echo "Usage: bash $0 [--dry-run] [--skip-wait] [--container=<name>]" >&2
      exit 1
      ;;
  esac
done

# ── Build target container list ───────────────────────────────────────────────
if [[ -n "$CONTAINER_FILTER" ]]; then
  CONTAINERS=("$CONTAINER_FILTER")
else
  CONTAINERS=("${ALL_CONTAINERS[@]}")
fi

# ── Pre-flight checks ─────────────────────────────────────────────────────────
echo ""
echo "================================================================"
echo " Cosmos DB: staging → dev  |  $(date '+%Y-%m-%d %H:%M')"
echo "================================================================"
echo "  Source  : $SRC_ACCOUNT  ($SRC_RG)"
echo "  Dest    : $DEST_ACCOUNT  ($DEST_RG)"
echo "  Database: $DATABASE"
echo "  Mode    : $( [[ "$DRY_RUN" == "true" ]] && echo "DRY RUN" || echo "LIVE" )"
echo "  Containers: ${#CONTAINERS[@]}"
echo "================================================================"
echo ""

echo "▷ Checking az login..."
ACCOUNT_NAME=$(az account show --query "name" -o tsv 2>/dev/null) || {
  echo "ERROR: Not logged in to Azure CLI. Run: az login" >&2
  exit 1
}
echo "  Logged in as subscription: $ACCOUNT_NAME"

echo "▷ Checking cosmosdb-preview extension..."
if ! az extension show --name cosmosdb-preview &>/dev/null; then
  echo "  Extension not found — installing cosmosdb-preview..."
  az extension add --name cosmosdb-preview
else
  echo "  cosmosdb-preview extension present."
fi

# ── Create copy jobs ──────────────────────────────────────────────────────────
echo ""
echo "▷ Creating copy jobs..."
echo ""

JOB_NAMES=()

for CONTAINER in "${CONTAINERS[@]}"; do
  JOB_NAME="${JOB_PREFIX}-${CONTAINER}"

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "  [dry-run] $CONTAINER  →  job: $JOB_NAME"
    continue
  fi

  echo "  ▶ $CONTAINER"
  az cosmosdb copy create \
    --account-name "$DEST_ACCOUNT" \
    --resource-group "$DEST_RG" \
    --job-name "$JOB_NAME" \
    --mode Offline \
    --src-account "$SRC_ACCOUNT" \
    --src-database "$DATABASE" \
    --src-container "$CONTAINER" \
    --dest-database "$DATABASE" \
    --dest-container "$CONTAINER" \
    --output table

  JOB_NAMES+=("$JOB_NAME")
done

if [[ "$DRY_RUN" == "true" ]]; then
  echo ""
  echo "Dry run complete — no jobs were created."
  exit 0
fi

if [[ ${#JOB_NAMES[@]} -eq 0 ]]; then
  echo "No containers matched. Nothing to do."
  exit 0
fi

# ── Skip polling if requested ─────────────────────────────────────────────────
if [[ "$SKIP_WAIT" == "true" ]]; then
  echo ""
  echo "${#JOB_NAMES[@]} job(s) created. Check status in the Azure portal:"
  echo "  Cosmos DB → $DEST_ACCOUNT → Data Migration"
  echo ""
  echo "Or poll manually:"
  for JOB_NAME in "${JOB_NAMES[@]}"; do
    echo "  az cosmosdb copy show --account-name $DEST_ACCOUNT --resource-group $DEST_RG --job-name $JOB_NAME"
  done
  exit 0
fi

# ── Poll until all jobs finish ────────────────────────────────────────────────
echo ""
echo "▷ Waiting for ${#JOB_NAMES[@]} job(s) to complete (polling every ${POLL_INTERVAL_SECONDS}s)..."
echo ""

FAILED_JOBS=()
COMPLETED_JOBS=()
PENDING_JOBS=("${JOB_NAMES[@]}")

while [[ ${#PENDING_JOBS[@]} -gt 0 ]]; do
  STILL_PENDING=()

  for JOB_NAME in "${PENDING_JOBS[@]}"; do
    STATUS=$(az cosmosdb copy show \
      --account-name "$DEST_ACCOUNT" \
      --resource-group "$DEST_RG" \
      --job-name "$JOB_NAME" \
      --query "properties.status" -o tsv 2>/dev/null || echo "Unknown")

    case "$STATUS" in
      Completed)
        echo "  ✅  $JOB_NAME — Completed"
        COMPLETED_JOBS+=("$JOB_NAME")
        ;;
      Failed|Cancelled)
        echo "  ❌  $JOB_NAME — $STATUS"
        FAILED_JOBS+=("$JOB_NAME")
        ;;
      *)
        STILL_PENDING+=("$JOB_NAME")
        ;;
    esac
  done

  PENDING_JOBS=("${STILL_PENDING[@]+"${STILL_PENDING[@]}"}")

  if [[ ${#PENDING_JOBS[@]} -gt 0 ]]; then
    echo "  ⏳  ${#PENDING_JOBS[@]} job(s) still running... (sleeping ${POLL_INTERVAL_SECONDS}s)"
    sleep "$POLL_INTERVAL_SECONDS"
  fi
done

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "================================================================"
echo " COPY SUMMARY"
echo "================================================================"
echo "  ✅ Completed : ${#COMPLETED_JOBS[@]}"
echo "  ❌ Failed    : ${#FAILED_JOBS[@]}"
echo "================================================================"

if [[ ${#FAILED_JOBS[@]} -gt 0 ]]; then
  echo ""
  echo "Failed jobs:"
  for JOB_NAME in "${FAILED_JOBS[@]}"; do
    echo "  - $JOB_NAME"
    echo "    az cosmosdb copy show --account-name $DEST_ACCOUNT --resource-group $DEST_RG --job-name $JOB_NAME"
  done
  echo ""
  exit 1
fi

echo ""
echo "All containers copied successfully."
echo "Next: spot-check with scripts/check-registry-contents.ts or query Cosmos directly."
echo ""
