# Axiom Live-Fire Staging Runbook (Do This Once, Reuse Forever)

This runbook is the permanent recovery guide for staging live-fire auth/data issues.

Use it when running:

- `pnpm axiom:livefire:preflight`
- `pnpm axiom:livefire:property-intake`
- `pnpm axiom:livefire:document-flow`
- `pnpm axiom:livefire:analyze-webhook`
- `pnpm axiom:livefire:bulk-submit`
- `pnpm axiom:livefire:ui-parity -- --mode <extraction|criteria|full>`
- `pnpm axiom:livefire:remote-suite`

## Canonical Staging Values

- Tenant: `885097ba-35ea-48db-be7a-a0aa7ff451bd`
- API app ID (audience): `dd3e7944-ecf3-4cd9-bf1d-ba1a4e857e8a`
- Interactive client app ID: `ee1cad4a-3049-409d-96e4-70c73fad2139`
- API scope: `api://dd3e7944-ecf3-4cd9-bf1d-ba1a4e857e8a/user_impersonation`
- Staging API base URL: `https://ca-appraisalapi-sta-lqxl.jollysand-19372da7.eastus.azurecontainerapps.io`

## One-Time Entra Setup (Admin)

Run once per tenant or whenever app registrations are recreated.

1) Ensure frontend app is public-client capable for device code:

```powershell
az ad app update --id ee1cad4a-3049-409d-96e4-70c73fad2139 --is-fallback-public-client true
```

2) Grant admin consent to frontend app requested permissions:

```powershell
az ad app permission admin-consent --id ee1cad4a-3049-409d-96e4-70c73fad2139
```

3) Ensure API app pre-authorizes frontend app for delegated scopes `Read` and `user_impersonation`:

```powershell
$payloadPath = Join-Path $PWD '.tmp-preauth-payload.json'
@'
{
  "api": {
    "preAuthorizedApplications": [
      {
        "appId": "ee1cad4a-3049-409d-96e4-70c73fad2139",
        "delegatedPermissionIds": [
          "f24c39d0-f357-52b8-b529-e2b289c98bb0",
          "f33ad329-fcb0-4999-9788-71498d9d5994"
        ]
      }
    ]
  }
}
'@ | Set-Content -Path $payloadPath -Encoding utf8

az rest --method PATCH \
  --url "https://graph.microsoft.com/v1.0/applications/679ca6c9-40b1-4bda-9a53-504c997181ec" \
  --headers "Content-Type=application/json" \
  --body "@$payloadPath"

Remove-Item $payloadPath -Force
```

4) Verify pre-authorization is present:

```powershell
az ad app show --id dd3e7944-ecf3-4cd9-bf1d-ba1a4e857e8a --query "api.preAuthorizedApplications" --output json
```

Expected delegated IDs include:

- `f24c39d0-f357-52b8-b529-e2b289c98bb0` (`Read`)
- `f33ad329-fcb0-4999-9788-71498d9d5994` (`user_impersonation`)

## Daily Run (Operator)

From `appraisal-management-backend`:

```powershell
$env:AXIOM_LIVE_BASE_URL='https://ca-appraisalapi-sta-lqxl.jollysand-19372da7.eastus.azurecontainerapps.io'
$env:AXIOM_LIVE_TENANT_ID='885097ba-35ea-48db-be7a-a0aa7ff451bd'
$env:AXIOM_LIVE_CLIENT_ID='statebridge'
$env:AXIOM_LIVE_USE_DEVICE_CODE='true'
$env:AXIOM_LIVE_DEVICE_CODE_CLIENT_ID='ee1cad4a-3049-409d-96e4-70c73fad2139'
$env:AXIOM_LIVE_DEVICE_CODE_TENANT_ID='885097ba-35ea-48db-be7a-a0aa7ff451bd'
$env:AXIOM_LIVE_TOKEN_SCOPE='api://dd3e7944-ecf3-4cd9-bf1d-ba1a4e857e8a/user_impersonation'

pnpm axiom:livefire:preflight
```

Then run target scripts.

## Backend-Only UI Parity (Deterministic Isolation)

Use this to isolate backend pipeline behavior from UI behavior.

1) Extraction-only:

```powershell
$env:AXIOM_LIVE_PARITY_MODE='extraction'
$env:AXIOM_LIVE_DOCUMENT_ID='<document-id>'
pnpm axiom:livefire:ui-parity -- --mode extraction
```

2) Criteria-only (from known snapshot):

```powershell
$env:AXIOM_LIVE_PARITY_MODE='criteria'
$env:AXIOM_LIVE_SNAPSHOT_ID='<snapshot-id>'
$env:AXIOM_LIVE_PROGRAM_ID='<program-id>'
$env:AXIOM_LIVE_CRITERIA_STEP_KEYS='overall-criteria'
pnpm axiom:livefire:ui-parity -- --mode criteria
```

3) Full UI-parity submit (document analyze path):

```powershell
$env:AXIOM_LIVE_PARITY_MODE='full'
$env:AXIOM_LIVE_DOCUMENT_ID='<document-id>'
$env:AXIOM_LIVE_ORDER_ID='<order-id>'
pnpm axiom:livefire:ui-parity -- --mode full
```

Interpretation:

- Extraction passes but full fails: issue is likely in analyze/orchestration integration, not extraction engine.
- Criteria fails with step-input retrieval issues: investigate snapshot linkage or criteria-step construction.
- All backend-only modes pass while UI path fails: issue is likely UI/request-shaping/state synchronization.

## If Preflight Fails With No Valid Order/Document Pair

This is a data-availability issue, not auth.

1) Seed fresh candidate data:

```powershell
$env:AXIOM_LIVE_BULK_ADAPTER_KEY='statebridge'
$env:AXIOM_LIVE_ANALYSIS_TYPE='QUICK_REVIEW'
pnpm axiom:livefire:bulk-submit
```

2) Re-run preflight:

```powershell
pnpm axiom:livefire:preflight
```

3) Use the printed exports from preflight for downstream flows.

## Error Code Triage (Fast)

- `AADSTS650057` + Azure CLI app id `04b07795-8ddb-461a-bbee-02f9e1bf7b46`
  - Cause: Azure CLI client is not allowed for your API resource scope.
  - Fix: use device-code flow (`AXIOM_LIVE_USE_DEVICE_CODE=true`) with interactive client app.

- `invalid_client` during device code
  - Cause: frontend app not public client, missing delegated scope wiring, or missing admin consent.
  - Fix: run One-Time Entra Setup above.

- `TEST_TOKEN_DISABLED`
  - Cause: staging blocks test JWT tokens by design.
  - Fix: use delegated user auth (device code) instead.

- Preflight: `No valid order/document pair found`
  - Cause: no eligible docs with usable storage URL/blob fields in scanned data.
  - Fix: run `axiom:livefire:bulk-submit`, then re-run preflight.
